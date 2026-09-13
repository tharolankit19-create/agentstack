import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOperatorApiUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ missionId: z.string().min(1).max(120) });

export async function POST(request: Request) {
  const auth = await requireOperatorApiUser();
  if (!auth.ok) return auth.response;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid approval." }, { status: 400 });

  const [kind, id] = parsed.data.missionId.split(":", 2);
  if (!id) return NextResponse.json({ error: "Invalid approval target." }, { status: 400 });

  const admin = createAdminClient();

  if (kind === "gen") {
    const { data, error } = await admin
      .from("generations")
      .update({ approved: true, approved_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", auth.session.userId)
      .eq("approved", false)
      .select("id")
      .maybeSingle<{ id: string }>();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "This item was already handled or not found." }, { status: 404 });
    return NextResponse.json({ ok: true, approved: id });
  }

  if (kind === "lead") {
    const { data, error } = await admin
      .from("leads")
      .update({ stage: "approved", updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", auth.session.userId)
      .eq("stage", "written")
      .select("id")
      .maybeSingle<{ id: string }>();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "This outreach was already handled or not found." }, { status: 404 });
    return NextResponse.json({ ok: true, approved: id });
  }

  return NextResponse.json({ error: "This mission does not need approval." }, { status: 400 });
}
