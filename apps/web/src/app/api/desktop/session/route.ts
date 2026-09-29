import { NextResponse } from "next/server";
import { z } from "zod";
import { requireDesktopUser, mintDeviceSession } from "@/lib/desktop-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const Body = z.object({ deviceId: z.string().uuid() });

export async function POST(request: Request) {
  const auth = await requireDesktopUser(request);
  if (!auth.ok) return auth.response;

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid device id." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: device } = await admin
    .from("devices")
    .select("id, revoked_at")
    .eq("id", parsed.data.deviceId)
    .eq("user_id", auth.auth.user.id)
    .maybeSingle<{ id: string; revoked_at: string | null }>();

  if (!device || device.revoked_at) {
    return NextResponse.json({ error: "Device not found or revoked." }, { status: 404 });
  }

  const session = await mintDeviceSession(admin, {
    deviceId: device.id,
    userId: auth.auth.user.id,
    userAgent: request.headers.get("user-agent"),
  });

  const now = new Date().toISOString();
  await admin
    .from("device_sessions")
    .update({ revoked_at: now, revoke_reason: "refreshed" })
    .eq("device_id", device.id)
    .is("revoked_at", null)
    .neq("id", session.sessionId);

  await admin.from("device_auth_events").insert({
    user_id: auth.auth.user.id,
    device_id: device.id,
    session_id: session.sessionId,
    event: "session_refreshed",
  });

  return NextResponse.json(
    { deviceToken: session.token, deviceTokenExpiresAt: session.expiresAt },
    { headers: { "Cache-Control": "no-store" } },
  );
}
