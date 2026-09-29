import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { tokenMatchesHash } from "@/lib/crypto";
import { mintDeviceSession } from "@/lib/desktop-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const Body = z.object({
  requestId: z.string().uuid(),
  code: z.string().min(32).max(256),
  state: z.string().min(24).max(256),
  codeVerifier: z.string().regex(/^[A-Za-z0-9._~-]{43,128}$/),
});

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid code exchange." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: authRequest } = await admin
    .from("desktop_auth_requests")
    .select("*")
    .eq("id", parsed.data.requestId)
    .maybeSingle();

  if (
    !authRequest ||
    !authRequest.user_id ||
    !authRequest.approved_at ||
    !authRequest.code_hash ||
    authRequest.consumed_at ||
    Date.parse(authRequest.expires_at) <= Date.now()
  ) {
    return NextResponse.json({ error: "Desktop authorization is invalid or expired." }, { status: 401 });
  }

  const challenge = createHash("sha256")
    .update(parsed.data.codeVerifier)
    .digest("base64url");

  const codeOk = tokenMatchesHash(parsed.data.code, authRequest.code_hash);
  const stateOk = parsed.data.state === authRequest.state;
  const pkceOk = challenge === authRequest.code_challenge;

  if (!codeOk || !stateOk || !pkceOk) {
    return NextResponse.json({ error: "Desktop authorization verification failed." }, { status: 401 });
  }

  const now = new Date().toISOString();
  const { data: device, error: deviceError } = await admin
    .from("devices")
    .upsert(
      {
        user_id: authRequest.user_id,
        installation_id: authRequest.installation_id,
        device_name: authRequest.device_name,
        platform: authRequest.platform,
        os_version: authRequest.os_version,
        app_version: authRequest.app_version,
        capabilities: authRequest.capabilities,
        permissions: authRequest.permissions,
        public_key: authRequest.public_key,
        status: "online",
        revoked_at: null,
        last_seen_at: now,
        updated_at: now,
      },
      { onConflict: "user_id,installation_id" },
    )
    .select("id, device_name, platform, status")
    .single();

  if (deviceError || !device) {
    console.error("[desktop/auth/exchange] device upsert failed", deviceError);
    return NextResponse.json({ error: "Could not register this Mac." }, { status: 500 });
  }

  const session = await mintDeviceSession(admin, {
    deviceId: device.id,
    userId: authRequest.user_id,
    userAgent: request.headers.get("user-agent"),
  });

  await admin
    .from("device_sessions")
    .update({ revoked_at: now, revoke_reason: "superseded" })
    .eq("device_id", device.id)
    .is("revoked_at", null)
    .neq("id", session.sessionId);

  const { data: consumed, error: consumeError } = await admin
    .from("desktop_auth_requests")
    .update({ consumed_at: now })
    .eq("id", authRequest.id)
    .is("consumed_at", null)
    .select("id")
    .maybeSingle();

  if (consumeError || !consumed) {
    await admin
      .from("device_sessions")
      .update({ revoked_at: now, revoke_reason: "authorization_replay_guard" })
      .eq("id", session.sessionId);
    return NextResponse.json({ error: "Desktop authorization was already used." }, { status: 409 });
  }

  await admin.from("device_auth_events").insert({
    user_id: authRequest.user_id,
    device_id: device.id,
    session_id: session.sessionId,
    event: "registered",
    meta: { flow: "pkce_desktop" },
  });

  return NextResponse.json(
    {
      device,
      deviceToken: session.token,
      deviceRefreshToken: session.refreshToken,
      deviceTokenExpiresAt: session.expiresAt,
      deviceRefreshExpiresAt: session.refreshExpiresAt,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
