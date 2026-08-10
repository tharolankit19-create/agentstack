import type { PlanTier } from "./supabase/types";

/**
 * Three plans, billed monthly, and the difference between them is **who runs
 * the thing** — not which agents you are allowed to have.
 *
 * That is the important part and the old page got it wrong. It listed named
 * agents against each tier, which reads as "you may have the content one",
 * and a customer who wanted the review agent then thinks the product does not
 * cover them. Every plan has the entire library. What you buy is how many run
 * at once, and whether the servers are yours or ours.
 *
 *   $29  — 3 agents,   you host,  your keys
 *   $59  — 10 agents,  we host,   your keys
 *   $149 — unlimited,  you host,  your keys
 *
 * The ladder is deliberately not monotonic on hosting, because the honest
 * version is not. We can host ten agents for someone at $59. We cannot host
 * unlimited agents for $149, and pretending otherwise would mean either a
 * quota with a different name or a bill we cannot pay.
 */

export interface Plan {
  tier: Exclude<PlanTier, "none">;
  name: string;
  priceUsd: number;
  /** How many agents this plan lets a customer run at once. */
  agentQuota: number;
  /** Shown instead of the number when the quota is effectively no limit. */
  quotaLabel: string;
  /** Who the agents run on. The real difference between the tiers. */
  hosting: "self" | "managed";
  /** One line about hosting, in the plan card. */
  hostingLine: string;
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

/**
 * Effectively no ceiling, expressed as a number.
 *
 * The quota is enforced by a Postgres trigger that compares a count against an
 * integer column, and giving that column a nullable "unlimited" meaning would
 * put a special case into the one piece of this that must never be wrong. A
 * customer who deploys 999 agents can have a conversation with us.
 */
export const UNLIMITED_QUOTA = 999;

export const PLANS: Record<Exclude<PlanTier, "none">, Plan> = {
  starter: {
    tier: "starter",
    name: "Starter",
    priceUsd: 29,
    agentQuota: 3,
    quotaLabel: "3 agents",
    hosting: "self",
    hostingLine: "Runs on your Vercel account, under your own API keys.",
    customAgents: false,
    tagline: "Pick any three. Cancel any three.",
    features: [
      "Any 3 agents from the whole library — you choose which",
      "Every agent we ship from now on, included, forever",
      "Live on their own URL in 90 seconds",
      "They run on a schedule without you",
      "Unlimited runs — no per-message pricing",
      "Deploys to your Vercel, on your own API keys",
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
    agentQuota: 10,
    quotaLabel: "10 agents",
    hosting: "managed",
    hostingLine: "We host all ten. No Vercel account, no deploy step, nothing to keep up.",
    customAgents: true,
    tagline: "Ten running, and none of them your problem.",
    features: [
      "Any 10 agents from the whole library, running at once",
      "We host every one of them — you never touch a deploy",
      "Paste any tool's URL and we build you an agent that replaces it",
      "Edit the prompts behind every agent",
      "Every agent we ship from now on, included, forever",
      "Unlimited runs — no per-message pricing",
      "Cancel in one click, keep everything you made",
    ],
    productId: process.env.NEXT_PUBLIC_DODO_PRODUCT_PRO,
    highlight: true,
    cta: "Let you host all 10",
    ctaSubtext: "$59/month. One seat of one tool you already pay for.",
  },
  unlimited: {
    tier: "unlimited",
    name: "Unlimited",
    priceUsd: 149,
    agentQuota: UNLIMITED_QUOTA,
    quotaLabel: "Unlimited agents",
    hosting: "self",
    hostingLine: "Runs on your own infrastructure, under your own API keys. No ceiling from us.",
    customAgents: true,
    tagline: "Every agent. No count. Your infrastructure.",
    features: [
      "Unlimited agents — the entire library, running at once",
      "Unlimited custom agents built from any tool's URL",
      "Your infrastructure, your API keys, no cap from us",
      "Edit every prompt, export every config",
      "Every agent we ship from now on, included, forever",
      "Unlimited runs — no per-message pricing",
      "Cancel in one click, keep everything you made",
    ],
    productId: process.env.NEXT_PUBLIC_DODO_PRODUCT_UNLIMITED,
    highlight: false,
    cta: "Take the whole library",
    ctaSubtext: "$149/month. Less than one seat of most tools on this page.",
  },
};

export const PLAN_LIST: Plan[] = [PLANS.starter, PLANS.pro, PLANS.unlimited];

export function planForProductId(productId: string): Plan | undefined {
  return PLAN_LIST.find((plan) => plan.productId === productId);
}

export function quotaForTier(tier: PlanTier): number {
  return tier === "none" ? 0 : PLANS[tier].agentQuota;
}

export function hasPaid(plan: PlanTier | null | undefined): boolean {
  return plan === "starter" || plan === "pro" || plan === "unlimited";
}

export function canBuildCustomAgents(plan: PlanTier | null | undefined): boolean {
  return plan === "pro" || plan === "unlimited";
}

/**
 * What this account may actually do.
 *
 * Every plan check in the app goes through here rather than reading
 * `profile.plan` directly, because there are two ways to be entitled — paying
 * for it, or being an admin — and a codebase where only some call sites know
 * about the second one is a codebase where the owner gets a paywall on their
 * own product in whichever place someone forgot.
 *
 * `is_admin` is set by hand in the database. The RLS policy on `profiles`
 * pins the column, so a customer cannot PATCH themselves into it with the
 * publishable key.
 */
export interface Entitled {
  plan: PlanTier;
  is_admin?: boolean | null;
}

export function isAdmin(profile: Entitled | null | undefined): boolean {
  return Boolean(profile?.is_admin);
}

/** Can this account use paid features at all? */
export function isEntitled(profile: Entitled | null | undefined): boolean {
  if (!profile) return false;
  return isAdmin(profile) || hasPaid(profile.plan);
}

/** Can this account build agents from arbitrary tool URLs? */
export function canBuildCustom(profile: Entitled | null | undefined): boolean {
  if (!profile) return false;
  return isAdmin(profile) || canBuildCustomAgents(profile.plan);
}

/** How many agents this account may run. Admins are uncapped. */
export function quotaFor(profile: Entitled & { agent_quota?: number }): number {
  if (isAdmin(profile)) return UNLIMITED_QUOTA;
  return profile.agent_quota ?? quotaForTier(profile.plan);
}

/** Does this account host its own agents, or do we host them? */
export function hostsOwnAgents(profile: Entitled): boolean {
  // Admins host wherever they have a token; otherwise it follows the plan.
  if (profile.plan === "none") return true;
  return PLANS[profile.plan].hosting === "self";
}

/** True when the quota is high enough that showing the number would be silly. */
export function isUnlimitedQuota(quota: number): boolean {
  return quota >= UNLIMITED_QUOTA;
}

/** "10 agents" or "Unlimited agents", for anywhere a quota is shown to a human. */
export function describeQuota(quota: number): string {
  return isUnlimitedQuota(quota) ? "unlimited agents" : `${quota} agents`;
}
