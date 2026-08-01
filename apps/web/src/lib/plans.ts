import type { PlanTier } from "./supabase/types";

/**
 * Two prices, one payment, no free plan.
 *
 * Pricing is one-time on purpose. A subscription is a decision the customer
 * re-makes every month; a one-time price is a decision they make once.
 */

export interface Plan {
  tier: Exclude<PlanTier, "none">;
  name: string;
  priceUsd: number;
  /** How many agents this plan lets a customer run. */
  agentQuota: number;
  tagline: string;
  features: string[];
  /** Dodo Payments product id, set per environment. */
  productId: string | undefined;
  highlight: boolean;
  cta: string;
}

export const PLANS: Record<Exclude<PlanTier, "none">, Plan> = {
  starter: {
    tier: "starter",
    name: "Starter",
    priceUsd: 29,
    agentQuota: 3,
    tagline: "Three agents. Yours forever.",
    features: [
      "3 agents, live in 90 seconds",
      "Content, Review and Lead agents",
      "Runs on our infrastructure — no server, no Docker",
      "Your API keys, encrypted, never shared",
      "Unlimited runs",
      "Pay once. No monthly bill.",
    ],
    productId: process.env.NEXT_PUBLIC_DODO_PRODUCT_STARTER,
    highlight: true,
    cta: "Deploy my 3 agents — $29",
  },
  pro: {
    tier: "pro",
    name: "Pro",
    priceUsd: 59,
    agentQuota: 25,
    tagline: "Every agent, plus your own infrastructure.",
    features: [
      "Everything in Starter",
      "25 agents instead of 3",
      "Deploy to your own Vercel account",
      "Custom domains on every agent",
      "Edit the prompts behind each agent",
      "Every agent we ship next, free",
    ],
    productId: process.env.NEXT_PUBLIC_DODO_PRODUCT_PRO,
    highlight: false,
    cta: "Get unlimited — $59",
  },
};

export const PLAN_LIST: Plan[] = [PLANS.starter, PLANS.pro];

export function planForProductId(productId: string): Plan | undefined {
  return PLAN_LIST.find((plan) => plan.productId === productId);
}

export function quotaForTier(tier: PlanTier): number {
  return tier === "none" ? 0 : PLANS[tier].agentQuota;
}

export function hasPaid(plan: PlanTier | null | undefined): boolean {
  return plan === "starter" || plan === "pro";
}
