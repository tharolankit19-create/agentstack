import { NextResponse } from "next/server";
import {
  extractPaymentFacts,
  isSuccessfulPayment,
  verifyWebhook,
} from "@/lib/dodo";
import { PLANS, planForProductId, quotaForTier } from "@/lib/plans";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PlanTier } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The only thing in this codebase that grants access.
 *
 * Three rules:
 *   1. Unsigned means untrusted. No signature, no plan.
 *   2. Replays are free. The same webhook delivered ten times grants the plan
 *      once, because Dodo retries and a retry must not double-count.
 *   3. Failures return 500 so the provider retries. Silently swallowing an
 *      error here means a customer who paid and cannot get in.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const event = verifyWebhook(rawBody, request.headers);

  if (!event) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  const admin = createAdminClient();

  // Idempotency: the primary key does the work. A duplicate delivery loses the
  // insert race and returns early.
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

  if (!isSuccessfulPayment(event)) {
    return NextResponse.json({ received: true, ignored: event.type });
  }

  const facts = extractPaymentFacts(event);
  const tier = resolveTier(facts.plan, facts.productIds);

  if (!tier) {
    console.error("[dodo] paid event with no recognisable plan:", {
      type: event.type,
      productIds: facts.productIds,
      plan: facts.plan,
    });
    return NextResponse.json({ received: true, ignored: "unknown_product" });
  }

  const userId = facts.userId ?? (await findUserByEmail(admin, facts.email));
  if (!userId) {
    // Payment is real, the buyer is not matched. Loud, because this is money
    // taken from someone who cannot get in.
    console.error("[dodo] paid event with no user to grant:", {
      paymentId: facts.paymentId,
      email: facts.email,
    });
    return NextResponse.json({ received: true, ignored: "unknown_user" });
  }

  const { error: purchaseError } = await admin.from("purchases").upsert(
    {
      user_id: userId,
      provider: "dodo",
      provider_payment_id: facts.paymentId,
      plan: tier,
      amount_cents: facts.amountCents || PLANS[tier].priceUsd * 100,
      currency: facts.currency,
      status: facts.status,
      payload: event.raw,
    },
    { onConflict: "provider,provider_payment_id" },
  );

  if (purchaseError) {
    console.error("[dodo] could not record purchase:", purchaseError);
    return NextResponse.json({ error: "Storage failed." }, { status: 500 });
  }

  // Upgrades stick; a second Starter purchase never demotes a Pro customer.
  const { data: profile } = await admin
    .from("profiles")
    .select("plan, agent_quota")
    .eq("id", userId)
    .maybeSingle<{ plan: PlanTier; agent_quota: number }>();

  const nextTier: PlanTier = profile?.plan === "pro" ? "pro" : tier;
  const nextQuota = Math.max(profile?.agent_quota ?? 0, quotaForTier(nextTier));

  const { error: grantError } = await admin
    .from("profiles")
    .update({
      plan: nextTier,
      agent_quota: nextQuota,
      purchased_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (grantError) {
    console.error("[dodo] could not grant plan:", grantError);
    return NextResponse.json({ error: "Grant failed." }, { status: 500 });
  }

  console.log(`[dodo] granted ${nextTier} (${nextQuota} agents) to ${userId}`);
  return NextResponse.json({ received: true, granted: nextTier });
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

async function findUserByEmail(
  admin: ReturnType<typeof createAdminClient>,
  email: string | null,
): Promise<string | null> {
  if (!email) return null;
  const { data } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle<{ id: string }>();
  return data?.id ?? null;
}
