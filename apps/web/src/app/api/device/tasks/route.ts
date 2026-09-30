import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyDeviceRequest } from "@/lib/desktop-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createHybridMission } from "@/lib/hybrid-missions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  instruction: z.string().trim().min(1).max(4000),
  requestedExecution: z.enum(["auto", "cloud", "macos", "windows", "linux", "android"]).default("auto"),
});

export async function POST(request: Request) {
  const auth = await verifyDeviceRequest(request);
  if (!auth.ok) return auth.response;

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid mission.", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  if (
    parsed.data.requestedExecution !== "auto" &&
    parsed.data.requestedExecution !== "cloud" &&
    parsed.data.requestedExecution !== auth.device.platform
  ) {
    return NextResponse.json(
      { error: `This device cannot claim ${parsed.data.requestedExecution} execution.` },
      { status: 409 },
    );
  }

  const admin = createAdminClient();

  try {
    const mission = await createHybridMission(admin, {
      userId: auth.device.userId,
      instruction: parsed.data.instruction,
      requestedExecution:
        parsed.data.requestedExecution === "auto"
          ? ["android", "macos", "windows", "linux"].includes(auth.device.platform)
            ? (auth.device.platform as "android" | "macos" | "windows" | "linux")
            : "auto"
          : parsed.data.requestedExecution,
      selectedDeviceId:
        parsed.data.requestedExecution === "cloud" ? null : auth.device.id,
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
    console.error("[device/tasks] mission create failed", cause);
    return NextResponse.json(
      { error: cause instanceof Error ? cause.message : "Could not create mission." },
      { status: 500 },
    );
  }
}
