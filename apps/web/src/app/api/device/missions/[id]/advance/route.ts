import { NextResponse } from "next/server";
import { verifyDeviceRequest } from "@/lib/desktop-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { advanceHybridMissions } from "@/lib/hybrid-missions";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await verifyDeviceRequest(request);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const admin = createAdminClient();
  const { data: mission } = await admin
    .from("hybrid_missions")
    .select("id, user_id, selected_device_id")
    .eq("id", id)
    .eq("user_id", auth.device.userId)
    .maybeSingle();

  if (!mission) {
    return NextResponse.json({ error: "Mission not found." }, { status: 404 });
  }

  if (mission.selected_device_id && mission.selected_device_id !== auth.device.id) {
    return NextResponse.json({ error: "Mission belongs to a different device." }, { status: 403 });
  }

  const result = await advanceHybridMissions(admin, 1, mission.id);
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
