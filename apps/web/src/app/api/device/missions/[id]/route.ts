import { NextResponse } from "next/server";
import { verifyDeviceRequest } from "@/lib/desktop-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { isVerifiedJobMission } from '@/lib/job-engine';

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await verifyDeviceRequest(request);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const admin = createAdminClient();

  const [{ data: mission }, { data: steps }, { data: evidence }, { data: approvals }] =
    await Promise.all([
      admin
        .from("hybrid_missions")
        .select("id,user_id,workspace_key,instruction,requested_execution,selected_device_id,status,planner,summary,estimated_credits,credits_used,created_at,started_at,finished_at,updated_at")
        .eq("id", id)
        .eq("user_id", auth.device.userId)
        .maybeSingle(),
      admin
        .from("hybrid_mission_steps")
        .select("id, ordinal, label, agent_template_id, execution, status, output, error_code, error_message, started_at, finished_at")
        .eq("mission_id", id)
        .eq("user_id", auth.device.userId)
        .order("ordinal", { ascending: true }),
      admin
        .from("task_evidence")
        .select("id, kind, title, source_url, content, created_at")
        .eq("mission_id", id)
        .eq("user_id", auth.device.userId)
        .order("created_at", { ascending: true })
        .limit(150),
      admin
        .from("action_approvals")
        .select("id, action_type, target, description, preview, risk_level, status, created_at")
        .eq("mission_id", id)
        .eq("user_id", auth.device.userId)
        .order("created_at", { ascending: true }),
    ]);

  if (!mission) {
    return NextResponse.json({ error: "Mission not found." }, { status: 404 });
  }
  if(isVerifiedJobMission(mission))return NextResponse.json({error:'Open source evidence in this job’s Job thread.',jobUrl:`/dashboard/jobs?id=${mission.id}`},{status:409,headers:{'Cache-Control':'private,no-store'}});

  return NextResponse.json(
    {
      mission,
      steps: steps ?? [],
      evidence: evidence ?? [],
      approvals: approvals ?? [],
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
