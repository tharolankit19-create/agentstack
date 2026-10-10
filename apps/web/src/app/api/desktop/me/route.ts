import { NextResponse } from "next/server";
import { verifyDeviceRequest } from "@/lib/desktop-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { rosterTemplateIds } from "@/lib/army";
import { LEGACY_MISSION_FILTER } from '@/lib/job-engine';

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await verifyDeviceRequest(request);
  if (!auth.ok) return auth.response;

  const admin = createAdminClient();
  const [profileResult, agentsResult, missionsResult, approvalsResult] = await Promise.all([
    admin
      .from("profiles")
      .select("id, email, full_name, avatar_url, company, credit_balance, credits_spent, created_at")
      .eq("id", auth.device.userId)
      .maybeSingle(),
    admin
      .from("agents")
      .select("id, template_id, name, status, paused, last_run_at")
      .eq("user_id", auth.device.userId)
      .in("template_id", rosterTemplateIds()),
    admin
      .from("hybrid_missions")
      .select("id, instruction, status, summary, requested_execution, credits_used, created_at, updated_at, finished_at")
      .eq("user_id", auth.device.userId)
      .or(LEGACY_MISSION_FILTER)
      .order("created_at", { ascending: false })
      .limit(12),
    admin
      .from("action_approvals")
      .select("id, mission_id, action_type, target, description, preview, risk_level, status, created_at")
      .eq("user_id", auth.device.userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  if (!profileResult.data) {
    return NextResponse.json({ error: "Kryx account profile not found." }, { status: 404 });
  }

  return NextResponse.json(
    {
      account: profileResult.data,
      agents: agentsResult.data ?? [],
      missions: missionsResult.data ?? [],
      approvals: approvalsResult.data ?? [],
      device: {
        id: auth.device.id,
        platform: auth.device.platform,
        capabilities: auth.device.capabilities,
        permissions: auth.device.permissions,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
