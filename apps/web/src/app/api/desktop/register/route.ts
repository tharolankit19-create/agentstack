import { NextResponse } from "next/server";
import { z } from "zod";
import { requireDesktopUser, mintDeviceSession } from "@/lib/desktop-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { taskSigningPublicKeyB64 } from "@/lib/device-task-signing";

export const dynamic = "force-dynamic";

const Body = z.object({
  installationId: z.string().uuid(),
  deviceName: z.string().trim().min(1).max(120),
  platform: z.enum(["macos", "windows", "linux", "android"]),
  osVersion: z.string().trim().max(120).optional(),
  appVersion: z.string().trim().max(80).optional(),
  publicKey: z.string().trim().min(32).max(4096).optional(),
  capabilities: z.record(z.string(), z.unknown()).default({}),
  permissions: z.record(z.string(), z.unknown()).default({}),
});

export async function POST(request: Request) {
  const auth = await requireDesktopUser(request);
  if (!auth.ok) return auth.response;

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid device registration.", issues: parsed.error.flatten() },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();
  const body = parsed.data;

  const { data: device, error } = await admin
    .from("devices")
    .upsert(
      {
        user_id: auth.auth.user.id,
        installation_id: body.installationId,
        device_name: body.deviceName,
        platform: body.platform,
        os_version: body.osVersion ?? null,
        app_version: body.appVersion ?? null,
        public_key: body.publicKey ?? null,
        capabilities: body.capabilities,
        permissions: body.permissions,
        status: "online",
        revoked_at: null,
        last_seen_at: now,
        updated_at: now,
      },
      { onConflict: "user_id,installation_id" },
    )
    .select("id, device_name, platform, os_version, app_version, status, capabilities, permissions, last_seen_at")
    .single();

  if (error || !device) {
    console.error("[desktop/register] device upsert failed", error);
    return NextResponse.json(
      { error: "Could not register this device." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }

  let session;
  try {
    session = await mintDeviceSession(admin, {
      deviceId: device.id,
      userId: auth.auth.user.id,
      userAgent: request.headers.get("user-agent"),
    });
  } catch (cause) {
    console.error("[desktop/register] session mint failed", cause);
    return NextResponse.json(
      { error: "Could not create a device session." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }

  // A fresh interactive registration supersedes old background credentials.
  await admin
    .from("device_sessions")
    .update({ revoked_at: now, revoke_reason: "superseded" })
    .eq("device_id", device.id)
    .is("revoked_at", null)
    .neq("id", session.sessionId);

  await admin.from("device_auth_events").insert({
    user_id: auth.auth.user.id,
    device_id: device.id,
    session_id: session.sessionId,
    event: "registered",
    meta: { platform: body.platform, app_version: body.appVersion ?? null },
  });

  return NextResponse.json(
    {
      device,
      deviceToken: session.token,
      deviceRefreshToken: session.refreshToken,
      deviceTokenExpiresAt: session.expiresAt,
      deviceRefreshExpiresAt: session.refreshExpiresAt,
      taskSigningPublicKeyB64: taskSigningPublicKeyB64(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
