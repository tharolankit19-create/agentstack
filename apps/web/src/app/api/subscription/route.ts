import { NextResponse } from "next/server";
import { requirePaidApiUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { cancelSubscription } from "@/lib/dodo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cancelling, in one click.
 *
 * The landing page promises this, so it has to be one request and not an email
 * to support. It cancels at the end of the paid period rather than immediately:
 * the customer paid through a date, and taking their agents away early over a
 * cancel click is the kind of thing that gets screenshotted.
 *
 * Access is not revoked here. The provider's `subscription.expired` webhook
 * does that when the period actually ends, which keeps one source of truth for
 * entitlements instead of two that can disagree.
 */
export async function DELETE() {
  const auth = await requirePaidApiUser();
  if (!auth.ok) return auth.response;

  const subscriptionId = auth.session.profile.subscription_id;
  if (!subscriptionId) {
    return NextResponse.json(
      { error: "There is no active subscription on this account." },
      { status: 409 },
    );
  }

  try {
    await cancelSubscription(subscriptionId);
  } catch (cause) {
    console.error("[subscription] cancel failed:", cause);
    return NextResponse.json(
      { error: "Could not cancel with the payment provider. Try again in a moment." },
      { status: 502 },
    );
  }

  await createAdminClient()
    .from("profiles")
    .update({ cancel_at_period_end: true })
    .eq("id", auth.session.userId);

  return NextResponse.json({
    ok: true,
    cancelAtPeriodEnd: true,
    activeUntil: auth.session.profile.current_period_end,
  });
}
