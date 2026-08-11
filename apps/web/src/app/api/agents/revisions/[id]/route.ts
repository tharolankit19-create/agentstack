import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { PromptRevision } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Switching a proposed prompt rewrite on, or discarding it.
 *
 * The agent writes the revision; the customer decides whether it runs. That
 * split is the whole reason self-editing prompts are safe here — a model that
 * can silently rewrite its own instructions has no stable behaviour and no way
 * back, whereas a numbered revision somebody switched on has both.
 *
 * PATCH activates. It has to deactivate the sibling first: there is a partial
 * unique index allowing exactly one live revision per prompt, and without the
 * clear-then-set the second activation would be refused by the database rather
 * than replacing what is there.
 */
export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const { id } = await params;

  // Read through the customer's own client, so RLS proves ownership before
  // anything is written with the admin one.
  const supabase = await createClient();
  const { data: revision } = await supabase
    .from("agent_prompt_revisions")
    .select("id, agent_id, prompt_name")
    .eq("id", id)
    .maybeSingle<Pick<PromptRevision, "id" | "agent_id" | "prompt_name">>();

  if (!revision) {
    return NextResponse.json({ error: "No such revision." }, { status: 404 });
  }

  const admin = createAdminClient();

  await admin
    .from("agent_prompt_revisions")
    .update({ active: false })
    .eq("agent_id", revision.agent_id)
    .eq("prompt_name", revision.prompt_name)
    .eq("active", true);

  const { error } = await admin
    .from("agent_prompt_revisions")
    .update({ active: true })
    .eq("id", revision.id);

  if (error) {
    return NextResponse.json(
      { error: "Could not switch that on." },
      { status: 500 },
    );
  }

  return NextResponse.json({ active: true });
}

/**
 * Discard it — or, for the live one, revert to the agent's original prompt.
 *
 * Deleting the active revision is how "put it back how it was" works: with no
 * active row, the runtime falls through to the template's own text, which is
 * still there and was never modified.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const supabase = await createClient();

  const { error } = await supabase
    .from("agent_prompt_revisions")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: "Could not discard that." }, { status: 500 });
  }

  return NextResponse.json({ discarded: true });
}
