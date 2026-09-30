import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  decision: z.enum(["approve", "reject"]),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid approval decision." }, { status: 400 });
  }

  const { id } = await context.params;
  const admin = createAdminClient();
  const { data: approval } = await admin
    .from("action_approvals")
    .select("*")
    .eq("id", id)
    .eq("user_id", auth.session.userId)
    .maybeSingle();

  if (!approval) {
    return NextResponse.json({ error: "Approval not found." }, { status: 404 });
  }

  if (approval.status !== "pending") {
    return NextResponse.json(
      { error: `This action is already ${approval.status}.` },
      { status: 409 },
    );
  }

  if (approval.expires_at && Date.parse(approval.expires_at) <= Date.now()) {
    await admin
      .from("action_approvals")
      .update({ status: "expired" })
      .eq("id", approval.id)
      .eq("status", "pending");

    return NextResponse.json({ error: "This approval expired." }, { status: 410 });
  }

  const now = new Date().toISOString();
  const status = parsed.data.decision === "approve" ? "approved" : "rejected";
  const { data: changed } = await admin
    .from("action_approvals")
    .update({
      status,
      approved_at: status === "approved" ? now : null,
      rejected_at: status === "rejected" ? now : null,
    })
    .eq("id", approval.id)
    .eq("user_id", auth.session.userId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle<{ id: string }>();

  if (!changed) {
    return NextResponse.json({ error: "Approval changed before your decision arrived." }, { status: 409 });
  }

  if (approval.task_id) {
    if (status === "approved") {
      // The task is placed back in a resumable state. The signed task envelope
      // that eventually executes the action must be newly issued; we never
      // reuse an old pre-approval envelope.
      await admin
        .from("device_tasks")
        .update({
          status: "queued",
          claimed_at: null,
          updated_at: now,
          error_code: null,
          error_message: null,
        })
        .eq("id", approval.task_id)
        .eq("status", "waiting_for_user");

      await admin
        .from("hybrid_mission_steps")
        .update({
          status: "queued",
          error_code: null,
          error_message: null,
        })
        .eq("id", approval.step_id);

      await admin
        .from("hybrid_missions")
        .update({ status: "queued", updated_at: now })
        .eq("id", approval.mission_id);
    } else {
      await Promise.all([
        admin
          .from("device_tasks")
          .update({
            status: "cancelled",
            finished_at: now,
            updated_at: now,
            error_code: "user_rejected",
            error_message: "Founder rejected the requested action.",
          })
          .eq("id", approval.task_id),
        admin
          .from("hybrid_mission_steps")
          .update({
            status: "cancelled",
            finished_at: now,
            error_code: "user_rejected",
            error_message: "Founder rejected the requested action.",
          })
          .eq("id", approval.step_id),
        admin
          .from("hybrid_missions")
          .update({
            status: "cancelled",
            summary: "Founder rejected the requested external action.",
            finished_at: now,
            updated_at: now,
          })
          .eq("id", approval.mission_id),
      ]);
    }
  }

  await admin.from("device_task_events").insert(
    approval.task_id
      ? {
          task_id: approval.task_id,
          mission_id: approval.mission_id,
          user_id: auth.session.userId,
          device_id:
            (
              await admin
                .from("device_tasks")
                .select("device_id")
                .eq("id", approval.task_id)
                .maybeSingle<{ device_id: string }>()
            ).data?.device_id,
          event_type: "approval",
          state: status,
          detail: {
            approval_id: approval.id,
            action_type: approval.action_type,
            risk_level: approval.risk_level,
          },
        }
      : {},
  ).catch(() => {});

  return NextResponse.json({ ok: true, status });
}
