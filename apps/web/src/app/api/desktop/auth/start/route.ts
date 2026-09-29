import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requiredEnv } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const Body = z.object({
  installationId: z.string().uuid(),
  deviceName: z.string().trim().min(1).max(120),
  platform: z.enum(["macos", "windows", "linux", "android"]),
  osVersion: z.string().trim().max(120).optional(),
  appVersion: z.string().trim().max(80).optional(),
  state: z.string().min(24).max(256),
  codeChallenge: z.string().regex(/^[A-Za-z0-9_-]{43,128}$/),
  redirectUri: z.literal("kryx://auth/callback").default("kryx://auth/callback"),
  publicKey: z.string().trim().min(32).max(4096).optional(),
  capabilities: z.record(z.string(), z.unknown()).default({}),
  permissions: z.record(z.string(), z.unknown()).default({}),
});

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid desktop authorization request." }, { status: 400 });
  }

  const admin = createAdminClient();
  const body = parsed.data;
  const { data, error } = await admin
    .from("desktop_auth_requests")
    .insert({
      installation_id: body.installationId,
      device_name: body.deviceName,
      platform: body.platform,
      os_version: body.osVersion ?? null,
      app_version: body.appVersion ?? null,
      state: body.state,
      code_challenge: body.codeChallenge,
      redirect_uri: body.redirectUri,
      public_key: body.publicKey ?? null,
      capabilities: body.capabilities,
      permissions: body.permissions,
    })
    .select("id, expires_at")
    .single<{ id: string; expires_at: string }>();

  if (error || !data) {
    console.error("[desktop/auth/start] insert failed", error);
    return NextResponse.json({ error: "Could not start desktop sign-in." }, { status: 500 });
  }

  const appUrl = requiredEnv("NEXT_PUBLIC_APP_URL").replace(/\/+$/, "");
  return NextResponse.json(
    {
      requestId: data.id,
      authorizeUrl: `${appUrl}/desktop/authorize/${data.id}`,
      expiresAt: data.expires_at,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
