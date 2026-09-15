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

const recurrenceSchema = z.enum(["once", "hourly", "daily"]);

const bodySchema = z.object({
  agentId: z.string().uuid(),
  instruction: z.string().trim().min(3).max(1200),
  recurrence: recurrenceSchema.default("once"),
  /** Browser-local datetime converted to ISO by the client. */
  startAt: z.string().datetime().optional(),
  /** Backward-compatible natural time phrase used by chat/delegation paths. */
  when: z.string().min(2).max(120).optional(),
});

export async function POST(request: Request) {
  const auth = await requireOperatorApiUser();
  if (!auth.ok) return auth.response;

  const limit = rateLimit(`schedule:${auth.session.userId}`, 40, 3600);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many schedule changes at once. Try again shortly." }, { status: 429 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Choose an agent, write the task, and pick when it should run." },
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

  if (!agent) return NextResponse.json({ error: "No such agent." }, { status: 404 });

  const config = await businessConfigFor(agent);
  const timezone = config.timezone || "UTC";

  let runAt: Date | null = null;
  let whenLabel = "";

  if (parsed.data.startAt) {
    const candidate = new Date(parsed.data.startAt);
    if (!Number.isNaN(candidate.getTime()) && candidate.getTime() > Date.now() + 30_000) {
      runAt = candidate;
      whenLabel = candidate.toISOString();
    }
  } else if (parsed.data.when) {
    const schedule = parseSchedule(
      `${parsed.data.when} ${parsed.data.instruction}`,
      timezone,
    );
    if (schedule) {
      runAt = schedule.runAt;
      whenLabel = schedule.whenLabel;
    }
  }

  if (!runAt) {
    return NextResponse.json(
      { error: "Pick a future first-run time." },
      { status: 400 },
    );
  }

  const { data, error } = await admin
    .from("scheduled_tasks")
    .insert({
      user_id: auth.session.userId,
      agent_id: agent.id,
      instruction: parsed.data.instruction,
      run_at: runAt.toISOString(),
      when_label: whenLabel,
      recurrence: parsed.data.recurrence,
      timezone,
    })
    .select("id, run_at, recurrence")
    .single<{ id: string; run_at: string; recurrence: "once" | "hourly" | "daily" }>();

  if (error) {
    console.error("[agents/schedule] insert failed:", error);
    return NextResponse.json(
      { error: "Could not save that schedule. The schedule database upgrade may still need to be applied." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, task: data });
}

const cancelSchema = z.object({ taskId: z.string().uuid() });

export async function DELETE(request: Request) {
  const auth = await requireOperatorApiUser();
  if (!auth.ok) return auth.response;

  const parsed = cancelSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid task." }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("scheduled_tasks")
    .update({ status: "cancelled" })
    .eq("id", parsed.data.taskId)
    .eq("user_id", auth.session.userId)
    .eq("status", "pending")
    .select("id");

  if (error) return NextResponse.json({ error: "Could not cancel that task." }, { status: 500 });
  if (!data?.length) return NextResponse.json({ error: "That task is no longer pending." }, { status: 409 });

  return NextResponse.json({ ok: true });
}
