import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyDeviceRequest } from "@/lib/desktop-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const Update = z.object({
  enabled: z.boolean(),
  excludedApps: z.array(z.string().min(1).max(240)).max(200).default([]),
  anonymousImprovement: z.boolean().default(false),
});

export async function GET(request: Request) {
  const auth = await verifyDeviceRequest(request);
  if (!auth.ok) return auth.response;

  const admin = createAdminClient();
  const { data } = await admin
    .from("observer_settings")
    .select("enabled, excluded_apps, anonymous_improvement, updated_at")
    .eq("device_id", auth.device.id)
    .eq("user_id", auth.device.userId)
    .maybeSingle();

  return NextResponse.json(
    {
      settings: data ?? {
        enabled: false,
        excluded_apps: [],
        anonymous_improvement: false,
        updated_at: null,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const auth = await verifyDeviceRequest(request);
  if (!auth.ok) return auth.response;

  const parsed = Update.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid Observer settings.", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { error } = await admin.from("observer_settings").upsert(
    {
      device_id: auth.device.id,
      user_id: auth.device.userId,
      enabled: parsed.data.enabled,
      excluded_apps: parsed.data.excludedApps,
      anonymous_improvement: parsed.data.anonymousImprovement,
      updated_at: now,
    },
    { onConflict: "device_id" },
  );

  if (error) {
    return NextResponse.json({ error: "Could not update Observer Mode." }, { status: 500 });
  }

  return NextResponse.json(
    {
      settings: {
        enabled: parsed.data.enabled,
        excludedApps: parsed.data.excludedApps,
        anonymousImprovement: parsed.data.anonymousImprovement,
        updatedAt: now,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
