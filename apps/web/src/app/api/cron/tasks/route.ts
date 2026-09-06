import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authorizeCron } from "@/lib/cron-auth";
import { sendMessage } from "@/lib/telegram";
import { chatKeyFor } from "@/lib/chat-model";
import { markWorking } from "@/lib/agent-activity";
import { runAgentOnce } from "@/lib/run-agent";
import { userEntitled } from "@/lib/entitlement";
import type { Agent, ScheduledTask } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * Doing the thing the founder scheduled.
 *
 * When a founder says "at 5pm, write the launch post and message me", the
 * webhook filed a row and confirmed. This is the half that makes the promise
 * true: it wakes on a schedule, finds tasks whose time has come, actually does
 * them with the head agent, and messages the founder the result on Telegram.
 *
 * A task runs at most once — claimed by flipping it out of `pending` before the
 * work starts, so two overlapping cron runs can't do it twice. Anything that
 * fails is marked failed with the reason rather than retried forever.
 */
export async function GET(request: Request) {
  if (!(await authorizeCron(request))) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const admin = createAdminClient();
  await admin.from("scheduled_tasks").update({ status: "failed", error: "The worker stopped before confirming completion. Review the saved outputs before scheduling a retry." })
    .eq("status", "running").lt("ran_at", new Date(Date.now() - 15 * 60_000).toISOString());

  const startedAt = Date.now();
  const { data: due, error: dueError } = await admin
    .from("scheduled_tasks")
    .select("*")
    .eq("status", "pending")
    .lte("run_at", new Date().toISOString())
    .order("run_at", { ascending: true })
    .limit(4);

  if (dueError) return NextResponse.json({ error: "Scheduled tasks could not be loaded." }, { status: 503 });

  const tasks = (due ?? []) as ScheduledTask[];
  let done = 0;

  for (const task of tasks) {
    if (Date.now() - startedAt > 210_000) break;
    // A task scheduled before the trial lapsed must not run for free after it.
    // Cancel it rather than leave it pending forever.
    if (!(await userEntitled(admin, task.user_id))) {
      await admin
        .from("scheduled_tasks")
        .update({ status: "cancelled", error: "Trial ended before this ran." })
        .eq("id", task.id)
        .eq("status", "pending");
      continue;
    }

    // Claim it first. If another run already flipped it, the update matches no
    // pending row and we skip — that is the single-run guarantee.
    const { data: claimed } = await admin
      .from("scheduled_tasks")
      .update({ status: "running", ran_at: new Date().toISOString() })
      .eq("id", task.id)
      .eq("status", "pending")
      .select("id");
    if (!claimed || claimed.length === 0) continue;

    try {
      // Show it on the dashboard: the head agent is carrying out what was asked.
      await markWorking(
        admin,
        task.user_id,
        "head-agent",
        "doing the task you scheduled",
        120,
        task.agent_id,
      );

      const result = await runTask(admin, task);

      const { error: completionError } = await admin
        .from("scheduled_tasks")
        .update({ result, status: "done", error: null })
        .eq("id", task.id)
        .eq("status", "running");
      if (completionError) throw new Error("Work finished, but its completion could not be saved. Review outputs before retrying.");
      done += 1;

      // Tell the founder, on the channel they asked on.
      const { data: link } = await admin
        .from("telegram_links")
        .select("chat_id")
        .eq("user_id", task.user_id)
        .maybeSingle<{ chat_id: string | null }>();

      if (link?.chat_id) {
        // Delivery failure must not change successfully completed work to failed.
        await sendMessage(
          link.chat_id,
          `Done - you asked me to ${task.instruction}. Here it is:\n\n${result}`,
        ).catch(() => console.error("[tasks] Telegram delivery failed", task.id));
      }

      // The shared runner already saved the output; do not create a duplicate.

    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Task failed.";
      await admin
        .from("scheduled_tasks")
        .update({ status: "failed", error: message })
        .eq("id", task.id)
        .eq("status", "running");
    }
  }

  return NextResponse.json({ ran: done, considered: tasks.length });
}

/**
 * Carry out one scheduled instruction, with whoever the founder assigned it to.
 *
 * The agent named on the task does the work. That is the whole point of being
 * able to assign one: a founder who schedules "audit the pricing page" against
 * the SEO agent has chosen the specialist, and running it on the head agent
 * instead silently discards that choice and produces a generalist's answer.
 *
 * A squad agent goes through the full run path — its own research, its own data
 * lookups, its craft, the quality gate — so a scheduled job is the same work as
 * a scheduled *run*, just with the founder's words instead of the template's.
 *
 * Head-agent production requests route to specialists. Ordinary conversation
 * falls back to chat. A due task executes now instead of scheduling itself again.
 */
async function runTask(
  admin: ReturnType<typeof createAdminClient>,
  task: ScheduledTask,
): Promise<string> {
  if (task.agent_id) {
    const { data: assigned, error: assignedError } = await admin
      .from("agents")
      .select("*")
      .eq("id", task.agent_id)
      .eq("user_id", task.user_id)
      .maybeSingle<Agent>();

    if (assignedError) throw new Error("The assigned agent could not be loaded.");
    if (!assigned) throw new Error("The assigned agent no longer exists.");
    if (assigned.paused) throw new Error("This agent is paused. Resume it before running tasks.");

    if (assigned.template_id !== "head-agent") {
      const result = await runAgentOnce(admin, assigned, {
        instruction: task.instruction,
        label: "on the job you scheduled",
      });
      if (!result.ok) throw new Error(result.reason ?? "The agent could not do it.");
      return result.content ?? "";
    }
  }

  const { data: head } = await admin
    .from("agents")
    .select("*")
    .eq("user_id", task.user_id)
    .eq("template_id", "head-agent")
    .maybeSingle<Agent>();

  if (!head) throw new Error("No head agent to run the task.");
  if (head.paused) throw new Error("The head agent is paused. Resume it before running tasks.");

  const apiKey = await chatKeyFor(head.id);
  if (!apiKey) throw new Error("No model key available.");

  const { executeHeadCommand } = await import("@/lib/head-orchestrator");
  const command = await executeHeadCommand(head, task.instruction, { allowSchedule: false });
  if (command.failed) throw new Error(command.reply || "The assigned work failed.");
  if (command.handled && command.reply) return command.reply;
  const { respondAsAgent } = await import("@/lib/chat-model");
  return respondAsAgent(head, [{ role: "user", content: task.instruction }], apiKey);
}
