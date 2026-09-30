import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RECOVERABLE = new Set([
  "login_required",
  "verification_required",
  "app_not_allowed",
  "accessibility_disabled",
  "browser_attention_required",
  "sheets_ui_changed",
  "sheets_paste_blocked",
]);

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const admin = createAdminClient();

  const { data: mission } = await admin
    .from("hybrid_missions")
    .select("id, status")
    .eq("id", id)
    .eq("user_id", auth.session.userId)
    .maybeSingle<{ id: string; status: string }>();

  if (!mission) {
    return NextResponse.json({ error: "Mission not found." }, { status: 404 });
  }

  const { data: pendingApproval } = await admin
    .from("action_approvals")
    .select("id")
    .eq("mission_id", mission.id)
    .eq("user_id", auth.session.userId)
    .eq("status", "pending")
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (pendingApproval) {
    return NextResponse.json(
      { error: "This mission needs an approval decision, not a retry." },
      { status: 409 },
    );
  }

  const { data: tasks } = await admin
    .from("device_tasks")
    .select("id, step_id, status, error_code")
    .eq("mission_id", mission.id)
    .eq("user_id", auth.session.userId)
    .eq("status", "waiting_for_user");

  const retryable = (tasks ?? []).filter(
    (task) => task.error_code && RECOVERABLE.has(task.error_code),
  );

  if (!retryable.length) {
    return NextResponse.json(
      { error: "No recoverable device blocker is waiting on you." },
      { status: 409 },
    );
  }

  const now = new Date().toISOString();
  for (const task of retryable) {
    await Promise.all([
      admin
        .from("device_tasks")
        .update({
          status: "queued",
          nonce: randomUUID(),
          claimed_at: null,
          error_code: null,
          error_message: null,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          updated_at: now,
        })
        .eq("id", task.id)
        .eq("status", "waiting_for_user"),
      admin
        .from("hybrid_mission_steps")
        .update({
          status: "queued",
          error_code: null,
          error_message: null,
        })
        .eq("id", task.step_id)
        .eq("status", "waiting_for_user"),
    ]);
  }

  await admin
    .from("hybrid_missions")
    .update({
      status: "waiting_for_device",
      summary: null,
      updated_at: now,
    })
    .eq("id", mission.id);

  return NextResponse.json({ ok: true, retried: retryable.length });
}
