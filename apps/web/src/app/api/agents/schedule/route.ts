import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOperatorApiUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseSchedule } from "@/lib/schedule";
import { businessConfigFor } from "@/lib/chat-model";
import { rateLimit } from "@/lib/rate-limit";
import type { Agent } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  agentId: z.string().uuid(),
  instruction: z.string().min(5).max(600),
  when: z.string().min(2).max(80),
});

/**
 * Give one named agent a job for later.
 *
 * The scheduled-task table has always supported this and nothing could reach
 * it except a sentence typed at the head agent. So the founder could schedule
 * work only by describing which squad member should do it and hoping the
 * routing was right — and on the Mission Control page, where the agents are
 * listed by name, there was no way to assign anything to any of them at all.
 *
 * The time is parsed deterministically rather than by a model. A founder who
 * types a time means that time, and a parser that is "usually" right is the one
 * thing you cannot ship for scheduling: the failure is invisible until the hour
 * comes and nothing happens.
 */
export async function POST(request: Request) {
  const auth = await requireOperatorApiUser();
  if (!auth.ok) return auth.response;

  const limit = rateLimit(`schedule:${auth.session.userId}`, 40, 3600);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many at once. Try again shortly." }, { status: 429 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Say what to do and when — both are needed." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data: agent } = await admin
    .from("agents")
    .select("id, user_id, template_id, name, config")
    .eq("id", parsed.data.agentId)
    .eq("user_id", auth.session.userId)
    .maybeSingle<Agent>();

  if (!agent) {
    return NextResponse.json({ error: "No such agent." }, { status: 404 });
  }

  // The founder's own timezone, from the head agent's settings. Scheduling "5pm"
  // in UTC for someone in Dubai is a four-hour error that looks like a bug in
  // the agent rather than in the clock.
  const config = await businessConfigFor(agent);
  const timezone = config.timezone || "UTC";

  // The parser wants one sentence, so the instruction and the time are joined
  // for it and the instruction is kept as the founder wrote it.
  const schedule = parseSchedule(`${parsed.data.when} ${parsed.data.instruction}`, timezone);

  if (!schedule) {
    return NextResponse.json(
      {
        error:
          'I could not read that time. Try "at 5pm", "tomorrow 9am", or "in 2 hours".',
      },
      { status: 400 },
    );
  }

  const { error } = await admin.from("scheduled_tasks").insert({
    user_id: auth.session.userId,
    agent_id: agent.id,
    instruction: parsed.data.instruction,
    run_at: schedule.runAt.toISOString(),
    when_label: schedule.whenLabel,
  });

  if (error) {
    console.error("[agents/schedule] insert failed:", error);
    return NextResponse.json({ error: "Could not save that." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    whenLabel: schedule.whenLabel,
    runAt: schedule.runAt.toISOString(),
  });
}
