import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { timingSafeEqualStrings } from "@/lib/crypto";
import { sendMessage } from "@/lib/telegram";
import { chatComplete, chatKeyFor, systemPromptFor } from "@/lib/chat-model";
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
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not set." }, { status: 503 });
  }
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!timingSafeEqualStrings(token, secret)) {
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
 * Carry out one scheduled instruction with the head agent.
 *
 * Runs on the same free-model, in-character path as chat, so the output sounds
 * like the founder's own agent and respects the style contract. The head agent
 * is the right one to run it: the founder addressed it, and it can pull in what
 * the squads produced if the task needs it.
 */
async function runTask(
  admin: ReturnType<typeof createAdminClient>,
  task: ScheduledTask,
): Promise<string> {
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
