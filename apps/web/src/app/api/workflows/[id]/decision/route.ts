import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const Body = z.object({
  decision: z.enum(["shadow", "ignore"]),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Choose shadow or ignore." }, { status: 400 });
  }

  const { id } = await context.params;
  const admin = createAdminClient();
  const patch =
    parsed.data.decision === "shadow"
      ? { status: "accepted", mode: "shadow" }
      : { status: "ignored", mode: "observe" };

  const { data, error } = await admin
    .from("detected_workflows")
    .update(patch)
    .eq("id", id)
    .eq("user_id", auth.session.userId)
    .in("status", ["detected", "accepted"])
    .select("id, status, mode")
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "Workflow is no longer available." }, { status: 409 });
  }

  return NextResponse.json({ workflow: data });
}
