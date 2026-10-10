import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { isVerifiedJobMission } from '@/lib/job-engine';

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
    return NextResponse.json({ error: "Choose approve or reject." }, { status: 400 });
  }

  const { id } = await context.params;
  const admin = createAdminClient();
  const { data: approval } = await admin
    .from("action_approvals")
    .select("*")
    .eq("id", id)
    .eq("user_id", auth.session.userId)
    .eq("status", "pending")
    .maybeSingle();

  if (!approval) {
    return NextResponse.json({ error: "Approval is no longer pending." }, { status: 409 });
  }
  const parent=await admin.from('hybrid_missions').select('id,planner').eq('id',approval.mission_id).eq('user_id',auth.session.userId).maybeSingle();
  if(parent.error)return NextResponse.json({error:'Could not safely inspect the approval job.'},{status:503});
  if(!parent.data)return NextResponse.json({error:'Approval mission not found.'},{status:404});
  if(isVerifiedJobMission(parent.data))return NextResponse.json({error:'This verified job requires its Job approval flow.'},{status:409});

  const now = new Date().toISOString();

  if (parsed.data.decision === "reject") {
    const { data: changed } = await admin
      .from("action_approvals")
      .update({ status: "rejected", rejected_at: now })
      .eq("id", approval.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();

    if (!changed) {
      return NextResponse.json({ error: "Approval was already handled." }, { status: 409 });
    }

    if (approval.task_id) {
      const { data: task } = await admin
        .from("device_tasks")
        .select("id, step_id, mission_id")
        .eq("id", approval.task_id)
        .eq("user_id", auth.session.userId)
        .maybeSingle();

      if (task) {
        await Promise.all([
          admin
            .from("device_tasks")
            .update({
              status: "cancelled",
              error_code: "founder_rejected",
              error_message: "Founder rejected the external action.",
              finished_at: now,
              updated_at: now,
            })
            .eq("id", task.id),
          admin
            .from("hybrid_mission_steps")
            .update({
              status: "cancelled",
              error_code: "founder_rejected",
              error_message: "Founder rejected the external action.",
              finished_at: now,
            })
            .eq("id", task.step_id),
          admin
            .from("hybrid_missions")
            .update({
              status: "cancelled",
              summary: "External action rejected by founder.",
              finished_at: now,
              updated_at: now,
            })
            .eq("id", task.mission_id),
        ]);
      }
    }

    return NextResponse.json({ ok: true, status: "rejected" });
  }

  const { data: changed } = await admin
    .from("action_approvals")
    .update({ status: "approved", approved_at: now })
    .eq("id", approval.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (!changed) {
    return NextResponse.json({ error: "Approval was already handled." }, { status: 409 });
  }

  if (approval.task_id) {
    const { data: task } = await admin
      .from("device_tasks")
      .select("*")
      .eq("id", approval.task_id)
      .eq("user_id", auth.session.userId)
      .eq("status", "waiting_for_user")
      .maybeSingle();

    if (task) {
      const payload =
        task.payload && typeof task.payload === "object" && !Array.isArray(task.payload)
          ? task.payload
          : {};

      await Promise.all([
        admin
          .from("device_tasks")
          .update({
            status: "queued",
            nonce: randomUUID(),
            claimed_at: null,
            finished_at: null,
            error_code: null,
            error_message: null,
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            updated_at: now,
            payload: {
              ...payload,
              approved_action: {
                approval_id: approval.id,
                action_type: approval.action_type,
                target: approval.target,
                preview: approval.preview,
                approved_at: now,
              },
            },
          })
          .eq("id", task.id),
        admin
          .from("hybrid_mission_steps")
          .update({
            status: "queued",
            error_code: null,
            error_message: null,
          })
          .eq("id", task.step_id),
        admin
          .from("hybrid_missions")
          .update({
            status: "waiting_for_device",
            summary: null,
            updated_at: now,
          })
          .eq("id", task.mission_id),
      ]);
    }
  }

  return NextResponse.json({ ok: true, status: "approved" });
}
