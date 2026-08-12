import { NextResponse } from "next/server";
import { requireOperatorApiUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Forgetting something.
 *
 * An agent that has concluded something wrong will act on it every morning
 * until somebody takes it away, so this is not a nice-to-have — it is the
 * correction path for a system that otherwise compounds its own mistakes.
 *
 * Deliberately the customer's own client rather than the admin one: the RLS
 * delete policy on `agent_notes` already restricts this to rows the caller
 * owns, so there is no id-checking here to get wrong.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireOperatorApiUser();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const supabase = await createClient();

  const { error } = await supabase.from("agent_notes").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: "Could not forget that." }, { status: 500 });
  }

  return NextResponse.json({ forgotten: true });
}
