import { NextResponse } from "next/server";
import { accessChangeFor, extractFacts, verifyWebhook, type SubscriptionFacts } from "@/lib/dodo";
import { CREDITS_PER_DOLLAR, MIN_TOPUP_USD } from "@/lib/credits-public";
import { PLANS, planForProductId, quotaForTier } from "@/lib/plans";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PlanTier } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const event = verifyWebhook(rawBody, request.headers);
  if (!event) return NextResponse.json({ error: "Invalid signature." }, { status: 401 });

  const admin = createAdminClient();
  const { error: seenError } = await admin
    .from("webhook_events")
    .insert({ id: event.id, provider: "dodo", type: event.type, payload: event.raw });

  // Critical: do NOT short-circuit a duplicate delivery. Dodo retries failed
  // messages with the same webhook-id. The old code recorded the id before the
  // credit RPC, so a transient DB error made every retry look "already done"
  // even though no credits had been added. Downstream writes are idempotent.
  if (seenError && seenError.code !== "23505") {
    const auditTableMissing =
      seenError.code === "42P01" ||
      seenError.code === "PGRST205" ||
      /webhook_events|schema cache/i.test(seenError.message ?? "");

    // Credit grants are independently idempotent on the provider reference.
    // Do not lose a paid top-up just because the optional webhook audit table
    // has not reached production yet.
    if (auditTableMissing) {
      console.warn("[dodo] webhook audit table is missing; continuing with idempotent grant.", {
        eventId: event.id,
      });
    } else {
      console.error("[dodo] could not record webhook:", seenError);
      return NextResponse.json({ error: "Storage failed." }, { status: 500 });
    }
  }

  const change = accessChangeFor(event);
  if (change === "ignore") return NextResponse.json({ received: true, ignored: event.type });

  const facts = extractFacts(event);
  const userId = facts.userId ?? (await findUser(admin, facts.email, facts.subscriptionId));
  if (!userId) {
    console.error("[dodo] event with no user to apply it to", {
      eventId: event.id,
      type: event.type,
      email: facts.email,
      paymentId: facts.paymentId,
    });
    // A successful payment must never be acknowledged as "ignored": Dodo
    // would stop retrying and the founder would have paid without receiving
    // credits. Return a retryable failure instead.
    return NextResponse.json(
      { error: "Payment succeeded but no Kryx account could be matched yet." },
      { status: 503 },
    );
  }

  // KryxAI top-ups are one-time payments. Metadata is the primary source of
  // truth, but Dodo also sends product_cart in payment webhooks. If metadata is
  // ever omitted by a checkout/payment transition, the configured credit
  // product + quantity still lets us recover the exact grant safely.
  const credits = creditGrantFor(facts);
  if (credits != null && change === "grant") {
    if (!Number.isSafeInteger(credits) || credits < 500 || credits > 500_000) {
      console.error("[dodo] invalid credit grant", {
        eventId: event.id,
        plan: facts.plan,
        credits,
        productIds: facts.productIds,
      });
      return NextResponse.json({ received: true, ignored: "invalid_credit_amount" });
    }

    const { data: balance, error } = await admin.rpc("add_credits", {
      p_user_id: userId,
      p_credits: credits,
      p_paid_cents: facts.amountCents,
      p_provider_ref: facts.paymentId ?? event.id,
    });

    if (error) {
      const missingRpc =
        error.code === "PGRST202" ||
        error.code === "42883" ||
        /add_credits|schema cache/i.test(error.message ?? "");
      console.error("[dodo] could not add credits:", {
        eventId: event.id,
        paymentId: facts.paymentId,
        userId,
        credits,
        code: error.code,
        message: error.message,
        missingRpc,
      });
      return NextResponse.json(
        {
          error: missingRpc
            ? "Credit database migration is not installed yet."
            : "Credit grant failed.",
        },
        { status: 503 },
      );
    }

    console.info("[dodo] credit top-up applied.", {
      eventId: event.id,
      paymentId: facts.paymentId,
      userId,
      credits,
      balance,
      duplicateDelivery: seenError?.code === "23505",
    });
    return NextResponse.json({
      received: true,
      credits,
      balance,
      duplicate: seenError?.code === "23505",
    });
  }

  if (change === "revoke") {
    const { error } = await admin.from("profiles").update({
      plan: "none", agent_quota: 0, subscription_status: statusFor(event.type),
      cancel_at_period_end: facts.cancelAtPeriodEnd, current_period_end: facts.currentPeriodEnd,
    }).eq("id", userId);
    if (error) return NextResponse.json({ error: "Revoke failed." }, { status: 500 });
    return NextResponse.json({ received: true, revoked: true });
  }

  const tier = resolveTier(facts.plan, facts.productIds);
  if (!tier) return NextResponse.json({ received: true, ignored: "unknown_product" });

  if (facts.paymentId) {
    const { error } = await admin.from("purchases").upsert({
      user_id: userId, provider: "dodo", provider_payment_id: facts.paymentId,
      subscription_id: facts.subscriptionId, plan: tier,
      amount_cents: facts.amountCents || PLANS[tier].priceUsd * 100,
      currency: facts.currency, status: facts.status || "succeeded",
      period_end: facts.currentPeriodEnd, payload: event.raw,
    }, { onConflict: "provider,provider_payment_id" });
    if (error) console.error("[dodo] could not record charge:", error);
  }

  const { error: grantError } = await admin.from("profiles").update({
    plan: tier, agent_quota: quotaForTier(tier),
    credits_included: PLANS[tier].creditsIncluded, credits_used: 0,
    credits_reset_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    subscription_id: facts.subscriptionId, subscription_status: "active",
    current_period_end: facts.currentPeriodEnd, cancel_at_period_end: facts.cancelAtPeriodEnd,
    subscribed_at: new Date().toISOString(),
  }).eq("id", userId);
  if (grantError) return NextResponse.json({ error: "Grant failed." }, { status: 500 });

  await admin.from("agents").update({ paused: false }).eq("user_id", userId).eq("paused", true);
  return NextResponse.json({ received: true, granted: tier });
}

function creditGrantFor(facts: SubscriptionFacts): number | null {
  const metadataMatch = /^credits:(\d+)$/.exec(facts.plan ?? "");
  if (metadataMatch) return Number(metadataMatch[1]);

  const creditProductId = process.env.DODO_CREDIT_PRODUCT_ID?.trim();
  if (!creditProductId) return null;

  const quantity = facts.productItems
    .filter((item) => item.productId === creditProductId)
    .reduce((total, item) => total + item.quantity, 0);
  if (quantity <= 0) return null;

  return quantity * MIN_TOPUP_USD * CREDITS_PER_DOLLAR;
}

function statusFor(eventType: string): string {
  if (eventType.includes("expired")) return "expired";
  if (eventType.includes("cancelled")) return "cancelled";
  if (eventType.includes("failed") || eventType.includes("on_hold")) return "past_due";
  return "cancelled";
}

function resolveTier(metadataPlan: string | null, productIds: string[]): Exclude<PlanTier, "none"> | null {
  if (metadataPlan === "starter" || metadataPlan === "pro") return metadataPlan;
  for (const productId of productIds) { const plan = planForProductId(productId); if (plan) return plan.tier; }
  return null;
}

async function findUser(admin: ReturnType<typeof createAdminClient>, email: string | null, subscriptionId: string | null): Promise<string | null> {
  if (subscriptionId) {
    const { data } = await admin.from("profiles").select("id").eq("subscription_id", subscriptionId).maybeSingle<{ id: string }>();
    if (data?.id) return data.id;
  }
  if (email) {
    const { data } = await admin.from("profiles").select("id").eq("email", email).maybeSingle<{ id: string }>();
    if (data?.id) return data.id;
  }
  return null;
}
