import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createHybridMission } from "@/lib/hybrid-missions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  instruction: z.string().trim().min(1).max(4000),
  execution: z.enum(["auto", "cloud", "macos", "android"]).default("auto"),
  deviceId: z.string().uuid().nullable().optional(),
});

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid mission.", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  if (parsed.data.deviceId) {
    const { data: device } = await admin
      .from("devices")
      .select("id, platform, revoked_at")
      .eq("id", parsed.data.deviceId)
      .eq("user_id", auth.session.userId)
      .is("revoked_at", null)
      .maybeSingle<{ id: string; platform: string; revoked_at: string | null }>();

    if (!device) {
      return NextResponse.json({ error: "Selected Kryx device was not found." }, { status: 404 });
    }

    if (
      parsed.data.execution !== "auto" &&
      parsed.data.execution !== "cloud" &&
      parsed.data.execution !== device.platform
    ) {
      return NextResponse.json(
        { error: `Selected device is ${device.platform}, not ${parsed.data.execution}.` },
        { status: 409 },
      );
    }
  }

  try {
    const mission = await createHybridMission(admin, {
      userId: auth.session.userId,
      instruction: parsed.data.instruction,
      requestedExecution: parsed.data.execution,
      selectedDeviceId: parsed.data.execution === "cloud" ? null : parsed.data.deviceId ?? null,
    });

    return NextResponse.json(
      {
        missionId: mission.missionId,
        status: mission.status,
        missingCapabilities: mission.missingCapabilities,
      },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (cause) {
    console.error("[hybrid missions] create failed", cause);
    return NextResponse.json(
      { error: cause instanceof Error ? cause.message : "Could not create Kryx mission." },
      { status: 500 },
    );
  }
}

export async function GET() {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("hybrid_missions")
    .select("id, instruction, requested_execution, selected_device_id, status, summary, estimated_credits, credits_used, created_at, started_at, finished_at, updated_at")
    .eq("user_id", auth.session.userId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: "Could not load hybrid missions." }, { status: 500 });
  }

  return NextResponse.json({ missions: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}
