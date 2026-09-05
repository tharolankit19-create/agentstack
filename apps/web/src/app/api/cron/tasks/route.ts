import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authorizeCron } from "@/lib/cron-auth";
import { sendMessage } from "@/lib/telegram";
import { chatComplete, chatKeyFor, systemPromptFor } from "@/lib/chat-model";
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

  const { data: due } = await admin
    .from("scheduled_tasks")
    .select("*")
    .eq("status", "pending")
    .lte("run_at", new Date().toISOString())
    .order("run_at", { ascending: true })
    .limit(25);

  const tasks = (due ?? []) as ScheduledTask[];
  let done = 0;

  for (const task of tasks) {
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
      .update({ status: "done", ran_at: new Date().toISOString() })
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

      await admin
        .from("scheduled_tasks")
        .update({ result })
        .eq("id", task.id);

      // Tell the founder, on the channel they asked on.
      const { data: link } = await admin
        .from("telegram_links")
        .select("chat_id")
        .eq("user_id", task.user_id)
        .maybeSingle<{ chat_id: string | null }>();

      if (link?.chat_id) {
        await sendMessage(
          link.chat_id,
          `Done - you asked me to ${task.instruction}. Here it is:\n\n${result}`,
        );
      }

      // And keep it in the shared thread + the output list.
      if (task.agent_id) {
        await admin.from("generations").insert({
          agent_id: task.agent_id,
          user_id: task.user_id,
          kind: "note",
          content: result,
          approved: true,
          meta: { scheduled: true, instruction: task.instruction },
        });
      }

      done += 1;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Task failed.";
      await admin
        .from("scheduled_tasks")
        .update({ status: "failed", error: message })
        .eq("id", task.id);
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
 * The head agent stays on the plain chat path. Its job is judgement rather than
 * production, it has no standing task and no lookups of its own, and pushing it
 * through the squad runner would file its answer as a draft to approve rather
 * than send it as a reply.
 */
async function runTask(
  admin: ReturnType<typeof createAdminClient>,
  task: ScheduledTask,
): Promise<string> {
  if (task.agent_id) {
    const { data: assigned } = await admin
      .from("agents")
      .select("id, user_id, template_id, name, config")
      .eq("id", task.agent_id)
      .eq("user_id", task.user_id)
      .maybeSingle<Agent>();

    if (assigned && assigned.template_id !== "head-agent") {
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

  const apiKey = await chatKeyFor(head.id);
  if (!apiKey) throw new Error("No model key available.");

  const system = await systemPromptFor(head);
  return chatComplete(apiKey, system, [
    {
      role: "user",
      content: `Do this now and give me the finished result, nothing else: ${task.instruction}`,
    },
  ]);
}
