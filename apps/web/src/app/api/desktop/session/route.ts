import { NextResponse } from "next/server";
import { rotateDeviceSession } from "@/lib/desktop-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rotated = await rotateDeviceSession(request);
  if (!rotated.ok) return rotated.response;

  const admin = createAdminClient();
  await admin.from("device_auth_events").insert({
    user_id: rotated.device.userId,
    device_id: rotated.device.id,
    session_id: rotated.session.sessionId,
    event: "session_refreshed",
  });

  return NextResponse.json(
    {
      deviceToken: rotated.session.token,
      deviceRefreshToken: rotated.session.refreshToken,
      deviceTokenExpiresAt: rotated.session.expiresAt,
      deviceRefreshExpiresAt: rotated.session.refreshExpiresAt,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
