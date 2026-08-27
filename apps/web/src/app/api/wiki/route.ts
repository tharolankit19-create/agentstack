import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The founder's control over the team's shared memory.
 *
 * Pin what the agents must never forget; delete what they got wrong. Both are
 * scoped to the caller's own rows — an id from someone else's cookbook matches
 * nothing, so a guessed id cannot reach another founder's memory.
 */

const bodySchema = z.object({
  id: z.string().uuid(),
  pinned: z.boolean().optional(),
});

export async function PATCH(request: Request) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Which entry?" }, { status: 400 });
  }

  await createAdminClient()
    .from("team_wiki")
    .update({ pinned: parsed.data.pinned ?? false })
    .eq("id", parsed.data.id)
    .eq("user_id", auth.session.userId);

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Which entry?" }, { status: 400 });
  }

  await createAdminClient()
    .from("team_wiki")
    .delete()
    .eq("id", parsed.data.id)
    .eq("user_id", auth.session.userId);

  return NextResponse.json({ ok: true });
}
