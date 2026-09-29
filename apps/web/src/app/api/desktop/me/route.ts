import { NextResponse } from "next/server";
import { verifyDeviceRequest } from "@/lib/desktop-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { rosterTemplateIds } from "@/lib/army";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await verifyDeviceRequest(request);
  if (!auth.ok) return auth.response;

  const admin = createAdminClient();
  const [profileResult, agentsResult] = await Promise.all([
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
  ]);

  if (!profileResult.data) {
    return NextResponse.json({ error: "Kryx account profile not found." }, { status: 404 });
  }

  return NextResponse.json(
    {
      account: profileResult.data,
      agents: agentsResult.data ?? [],
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
