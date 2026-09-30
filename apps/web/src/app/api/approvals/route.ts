import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("action_approvals")
    .select("id, mission_id, action_type, target, description, preview, risk_level, status, created_at, expires_at")
    .eq("user_id", auth.session.userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: "Could not load approvals." }, { status: 500 });
  }

  return NextResponse.json({ approvals: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}
