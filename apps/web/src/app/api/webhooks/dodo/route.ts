import { NextResponse } from "next/server";
import { accessChangeFor, extractFacts, verifyWebhook } from "@/lib/dodo";
import { PLANS, planForProductId, quotaForTier } from "@/lib/plans";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PlanTier } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The only thing in this codebase that grants or removes access.
 *
 * Four rules:
 *   1. Unsigned means untrusted. No signature, no plan.
 *   2. Replays are free. The same event delivered ten times changes state once.
 *   3. Failures return 500 so the provider retries. Swallowing an error here
 *      means a customer who paid and cannot get in.
 *   4. Revocation is as important as granting. A subscription product that
 *      only knows how to turn access on is a free product with extra steps.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const event = verifyWebhook(rawBody, request.headers);

  if (!event) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  const admin = createAdminClient();

  // Idempotency: the primary key does the work. A duplicate loses the race.
  const { error: seenError } = await admin.from("webhook_events").insert({
    id: event.id,
    provider: "dodo",
    type: event.type,
    payload: event.raw,
  });

  if (seenError) {
    if (seenError.code === "23505") {
      return NextResponse.json({ received: true, duplicate: true });
    }
    console.error("[dodo] could not record webhook:", seenError);
    return NextResponse.json({ error: "Storage failed." }, { status: 500 });
  }

  const change = accessChangeFor(event);
  if (change === "ignore") {
    return NextResponse.json({ received: true, ignored: event.type });
  }

  const facts = extractFacts(event);
  const userId = facts.userId ?? (await findUser(admin, facts.email, facts.subscriptionId));

  if (!userId) {
    // Money moved and the payer is unmatched. Loud, because someone is now
    // paying for something they cannot open.
    console.error("[dodo] event with no user to apply it to:", {
      type: event.type,
      subscriptionId: facts.subscriptionId,
      email: facts.email,
    });
    return NextResponse.json({ received: true, ignored: "unknown_user" });
  }

  if (change === "revoke") {
    const { error } = await admin
      .from("profiles")
      .update({
        plan: "none",
        agent_quota: 0,
        subscription_status: statusFor(event.type),
        cancel_at_period_end: facts.cancelAtPeriodEnd,
        current_period_end: facts.currentPeriodEnd,
      })
      .eq("id", userId);

    if (error) {
      console.error("[dodo] could not revoke access:", error);
      return NextResponse.json({ error: "Revoke failed." }, { status: 500 });
    }

    // A database trigger pauses their agents when the quota drops to zero, so
    // nothing keeps running — and burning their OpenAI key — after they stop
    // paying. Their configuration and history are untouched.
    console.log(`[dodo] revoked access for ${userId} (${event.type})`);
    return NextResponse.json({ received: true, revoked: true });
  }

  const tier = resolveTier(facts.plan, facts.productIds);
  if (!tier) {
    console.error("[dodo] grant event with no recognisable plan:", {
      type: event.type,
      productIds: facts.productIds,
    });
    return NextResponse.json({ received: true, ignored: "unknown_product" });
  }

  if (facts.paymentId) {
    const { error } = await admin.from("purchases").upsert(
      {
        user_id: userId,
        provider: "dodo",
        provider_payment_id: facts.paymentId,
        subscription_id: facts.subscriptionId,
        plan: tier,
        amount_cents: facts.amountCents || PLANS[tier].priceUsd * 100,
        currency: facts.currency,
        status: facts.status || "succeeded",
        period_end: facts.currentPeriodEnd,
        payload: event.raw,
      },
      { onConflict: "provider,provider_payment_id" },
    );
    if (error) console.error("[dodo] could not record the charge:", error);
  }

  const { error: grantError } = await admin
    .from("profiles")
    .update({
      plan: tier,
      agent_quota: quotaForTier(tier),
      subscription_id: facts.subscriptionId,
      subscription_status: "active",
      current_period_end: facts.currentPeriodEnd,
      cancel_at_period_end: facts.cancelAtPeriodEnd,
      subscribed_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (grantError) {
    console.error("[dodo] could not grant plan:", grantError);
    return NextResponse.json({ error: "Grant failed." }, { status: 500 });
  }

  // Coming back from a lapse should turn their agents back on, since the
  // lapse is what paused them.
  await admin
    .from("agents")
    .update({ paused: false })
    .eq("user_id", userId)
    .eq("paused", true);

  console.log(`[dodo] granted ${tier} to ${userId} (${event.type})`);
  return NextResponse.json({ received: true, granted: tier });
}

function statusFor(eventType: string): string {
  if (eventType.includes("expired")) return "expired";
  if (eventType.includes("cancelled")) return "cancelled";
  if (eventType.includes("failed") || eventType.includes("on_hold")) return "past_due";
  return "cancelled";
}

function resolveTier(
  metadataPlan: string | null,
  productIds: string[],
): Exclude<PlanTier, "none"> | null {
  if (metadataPlan === "starter" || metadataPlan === "pro") return metadataPlan;
  for (const productId of productIds) {
    const plan = planForProductId(productId);
    if (plan) return plan.tier;
  }
  return null;
}

async function findUser(
  admin: ReturnType<typeof createAdminClient>,
  email: string | null,
  subscriptionId: string | null,
): Promise<string | null> {
  // A renewal or cancellation carries the subscription but not our metadata,
  // so the subscription id is the more reliable lookup of the two.
  if (subscriptionId) {
    const { data } = await admin
      .from("profiles")
      .select("id")
      .eq("subscription_id", subscriptionId)
      .maybeSingle<{ id: string }>();
    if (data?.id) return data.id;
  }

  if (email) {
    const { data } = await admin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle<{ id: string }>();
    if (data?.id) return data.id;
  }

  return null;
}
