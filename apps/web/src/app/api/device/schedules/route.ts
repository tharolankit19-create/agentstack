import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyDeviceRequest } from "@/lib/desktop-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const Body = z.object({
  instruction: z.string().trim().min(1).max(2000),
  runAt: z.string().datetime(),
  whenLabel: z.string().trim().max(200).optional(),
  recurrence: z.enum(["once", "hourly", "daily"]).default("once"),
  timezone: z.string().trim().min(1).max(100).default("UTC"),
});

export async function POST(request: Request) {
  const auth = await verifyDeviceRequest(request);
  if (!auth.ok) return auth.response;

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid scheduled mission.", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  if (Date.parse(parsed.data.runAt) <= Date.now() - 60_000) {
    return NextResponse.json({ error: "Scheduled time is already in the past." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("scheduled_tasks")
    .insert({
      user_id: auth.device.userId,
      agent_id: null,
      instruction: parsed.data.instruction,
      run_at: parsed.data.runAt,
      when_label: parsed.data.whenLabel ?? null,
      recurrence: parsed.data.recurrence,
      timezone: parsed.data.timezone,
      status: "pending",
      execution_target: auth.device.platform,
      device_id: auth.device.id,
    })
    .select("id, run_at, recurrence, timezone")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Could not schedule mission." }, { status: 500 });
  }

  return NextResponse.json({ schedule: data }, { status: 201 });
}
