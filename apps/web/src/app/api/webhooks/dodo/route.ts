import { NextResponse } from "next/server";
import { accessChangeFor, extractFacts, verifyWebhook } from "@/lib/dodo";
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
  const { error: seenError } = await admin.from("webhook_events").insert({ id: event.id, provider: "dodo", type: event.type, payload: event.raw });
  if (seenError) {
    if (seenError.code === "23505") return NextResponse.json({ received: true, duplicate: true });
    console.error("[dodo] could not record webhook:", seenError);
    return NextResponse.json({ error: "Storage failed." }, { status: 500 });
  }

  const change = accessChangeFor(event);
  if (change === "ignore") return NextResponse.json({ received: true, ignored: event.type });

  const facts = extractFacts(event);
  const userId = facts.userId ?? (await findUser(admin, facts.email, facts.subscriptionId));
  if (!userId) {
    console.error("[dodo] event with no user to apply it to", { type: event.type, email: facts.email });
    return NextResponse.json({ received: true, ignored: "unknown_user" });
  }

  // KryxAI top-ups are one-time payments. The server-created checkout writes
  // `credits:<number>` into signed provider metadata, so the browser can never
  // choose how many credits a successful payment grants.
  const creditMatch = /^credits:(\d+)$/.exec(facts.plan ?? "");
  if (creditMatch && change === "grant") {
    const credits = Number(creditMatch[1]);
    if (!Number.isSafeInteger(credits) || credits < 500 || credits > 500_000) {
      console.error("[dodo] invalid credit grant", facts.plan);
      return NextResponse.json({ received: true, ignored: "invalid_credit_amount" });
    }
    const { data: balance, error } = await admin.rpc("add_credits", {
      p_user_id: userId,
      p_credits: credits,
      p_paid_cents: facts.amountCents,
      p_provider_ref: facts.paymentId ?? event.id,
    });
    if (error) {
      console.error("[dodo] could not add credits:", error);
      return NextResponse.json({ error: "Credit grant failed." }, { status: 500 });
    }
    return NextResponse.json({ received: true, credits, balance });
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
