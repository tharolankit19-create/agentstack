import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyDeviceRequest } from "@/lib/desktop-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { reconcileDeviceMissions } from "@/lib/hybrid-missions";

export const dynamic = "force-dynamic";

const Body = z.object({
  appVersion: z.string().trim().max(80).optional(),
  osVersion: z.string().trim().max(120).optional(),
  capabilities: z.record(z.string(), z.unknown()).optional(),
  permissions: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: Request) {
  const auth = await verifyDeviceRequest(request);
  if (!auth.ok) return auth.response;

  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid heartbeat payload." }, { status: 400 });
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    status: "online",
    last_seen_at: now,
    updated_at: now,
  };
  if (parsed.data.appVersion !== undefined) patch.app_version = parsed.data.appVersion;
  if (parsed.data.osVersion !== undefined) patch.os_version = parsed.data.osVersion;
  if (parsed.data.capabilities !== undefined) patch.capabilities = parsed.data.capabilities;
  if (parsed.data.permissions !== undefined) patch.permissions = parsed.data.permissions;

  const { error } = await admin
    .from("devices")
    .update(patch)
    .eq("id", auth.device.id)
    .eq("user_id", auth.device.userId);

  if (error) {
    console.error("[desktop/heartbeat] update failed", error);
    return NextResponse.json({ error: "Heartbeat could not be recorded." }, { status: 500 });
  }

  const capabilities =
    parsed.data.capabilities ?? auth.device.capabilities ?? {};
  const recovered = await reconcileDeviceMissions(admin, {
    userId: auth.device.userId,
    deviceId: auth.device.id,
    capabilities,
  });

  return NextResponse.json(
    { ok: true, serverTime: now, recoveredMissions: recovered },
    { headers: { "Cache-Control": "no-store" } },
  );
}
