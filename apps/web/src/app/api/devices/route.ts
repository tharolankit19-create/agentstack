import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("devices")
    .select("id, device_name, platform, os_version, app_version, status, capabilities, permissions, created_at, last_seen_at, revoked_at")
    .eq("user_id", auth.session.userId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Could not load devices." }, { status: 500 });
  }

  const now = Date.now();
  const devices = (data ?? []).map((device) => ({
    ...device,
    status:
      device.revoked_at
        ? "revoked"
        : device.last_seen_at && now - Date.parse(device.last_seen_at) < 90_000
          ? "online"
          : "offline",
  }));

  return NextResponse.json({ devices });
}
