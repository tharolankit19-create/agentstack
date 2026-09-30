import { NextResponse } from "next/server";
import { verifyDeviceRequest } from "@/lib/desktop-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await verifyDeviceRequest(request);
  if (!auth.ok) return auth.response;

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("revoke_device", {
    p_user_id: auth.device.userId,
    p_device_id: auth.device.id,
    p_reason: "desktop_logout",
  });

  if (error || data !== true) {
    return NextResponse.json({ error: "Could not revoke this device." }, { status: 500 });
  }

  await admin.from("device_auth_events").insert({
    user_id: auth.device.userId,
    device_id: auth.device.id,
    session_id: auth.device.sessionId,
    event: "revoked",
    meta: { source: "desktop" },
  });

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
