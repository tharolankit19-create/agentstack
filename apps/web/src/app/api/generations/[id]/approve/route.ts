import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { isEntitled } from "@/lib/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Approve or reject a draft, from anywhere in the product.
 *
 * This did not exist. Approving was possible **only by replying "1" to a
 * Telegram message** — there was no endpoint, no button, and the "needs your
 * approval" card on the board was a link to `/dashboard/agents/[id]`, which
 * opens on the agent's API-key form. So the founder pressed the thing labelled
 * approve and landed on a settings page, which is exactly what was reported.
 *
 * Approval is a one-field update and nothing about it needs a page. The button
 * lives on the card, the row updates in place, and the founder never leaves the
 * board — the whole point of a board is that the work comes to you.
 *
 * Ownership is checked by scoping the update to `user_id`, not by reading the
 * row first: one statement that cannot match someone else's draft is safer than
 * a check followed by a write, and it is also one fewer round trip on the path
 * the founder is waiting on.
 */

const bodySchema = z
  .object({
    /** false rejects instead. A rejected draft leaves the board without being deleted. */
    approved: z.boolean().default(true),
  })
  .nullable();

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // Deliberately `requireUser`. Approving is reading your own work and saying
  // yes to it — gating it behind an operator check is what sends someone to a
  // paywall for the one action that costs nothing to serve.
  const session = await requireUser();
  const { id } = await params;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  const approved = parsed.success ? (parsed.data?.approved ?? true) : true;

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("generations")
    .update({
      approved,
      approved_at: approved ? new Date().toISOString() : null,
    })
    .eq("id", id)
    .eq("user_id", session.userId)
    .select("id, approved")
    .maybeSingle<{ id: string; approved: boolean }>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    // Not found and not yours are the same answer on purpose: a different
    // message for each would confirm that someone else's draft id exists.
    return NextResponse.json({ error: "That draft is not there." }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    approved: data.approved,
    // The founder gets told when approving is all that is needed and when
    // something further happens on their behalf.
    message: approved ? "Approved." : "Sent back.",
    entitled: isEntitled(session.profile),
  });
}
