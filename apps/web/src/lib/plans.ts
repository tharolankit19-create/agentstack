import type { PlanTier } from "./supabase/types";

/**
 * Two plans, billed monthly.
 *
 * The pitch is arithmetic: the customer is already paying four figures a month
 * for tools that each do one thing. This costs less than any single one of
 * them and replaces the lot. That comparison only lands if the price is also
 * monthly — "$29 once" invites a different, weaker question.
 */

export interface Plan {
  tier: Exclude<PlanTier, "none">;
  name: string;
  priceUsd: number;
  /** How many agents this plan lets a customer run at once. */
  agentQuota: number;
  /** Can this customer generate agents from their own SaaS? */
  customAgents: boolean;
  tagline: string;
  features: string[];
  /** Dodo Payments product id for the recurring price. */
  productId: string | undefined;
  highlight: boolean;
  cta: string;
  /** Sits under the button. Removes the last objection, not a feature list. */
  ctaSubtext: string;
}

export const PLANS: Record<Exclude<PlanTier, "none">, Plan> = {
  starter: {
    tier: "starter",
    name: "Starter",
    priceUsd: 29,
    agentQuota: 3,
    customAgents: false,
    tagline: "Cancel three subscriptions this month.",
    features: [
      "Any 3 agents from the library",
      "Live on their own URL in 90 seconds",
      "They run on a schedule without you",
      "Unlimited runs — no per-message pricing",
      "Your API keys, encrypted, never shared",
      "Cancel in one click, keep everything you made",
    ],
    productId: process.env.NEXT_PUBLIC_DODO_PRODUCT_STARTER,
    highlight: false,
    cta: "Replace my first 3 tools",
    ctaSubtext: "$29/month. Cancel anytime, in one click.",
  },
  pro: {
    tier: "pro",
    name: "Pro",
    priceUsd: 59,
    agentQuota: 25,
    customAgents: true,
    tagline: "Cancel the rest of them.",
    features: [
      "Every agent in the library — all 12, and everything we ship next",
      "Paste any tool's URL and we build you an agent that replaces it",
      "25 agents running at once",
      "Edit the prompts behind every agent",
      "Deploy to your own Vercel account",
      "Cancel in one click, keep everything you made",
    ],
    productId: process.env.NEXT_PUBLIC_DODO_PRODUCT_PRO,
    highlight: true,
    cta: "Replace my whole stack",
    ctaSubtext: "$59/month. Less than one seat of the cheapest tool you pay for.",
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

export function canBuildCustomAgents(plan: PlanTier | null | undefined): boolean {
  return plan === "pro";
}
