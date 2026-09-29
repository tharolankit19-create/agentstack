import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const Rename = z.object({ deviceName: z.string().trim().min(1).max(120) });

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const parsed = Rename.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid device name." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("devices")
    .update({ device_name: parsed.data.deviceName, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", auth.session.userId)
    .is("revoked_at", null)
    .select("id, device_name")
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "Device not found." }, { status: 404 });
  }

  await admin.from("device_auth_events").insert({
    user_id: auth.session.userId,
    device_id: id,
    event: "renamed",
  });

  return NextResponse.json({ device: data });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("revoke_device", {
    p_user_id: auth.session.userId,
    p_device_id: id,
    p_reason: "user_revoked",
  });

  if (error || data !== true) {
    return NextResponse.json({ error: "Device not found or already revoked." }, { status: 404 });
  }

  await admin.from("device_auth_events").insert({
    user_id: auth.session.userId,
    device_id: id,
    event: "revoked",
  });

  return NextResponse.json({ ok: true });
}
