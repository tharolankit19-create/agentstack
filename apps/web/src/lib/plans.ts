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
 *   $29  — 3 squads,     you host, your model key
 *   $59  — all 6 squads, you host, your model key
 *   $140 — unlimited,    you host, your model key
 *
 * Nothing deploys without one of them. There is no free tier and no
 * deploy-without-paying path: the one-day trial below is part of the $29
 * plan, not an alternative to it.
 *
 * Every tier is bring-your-own-key and self-hosted, and that is the model
 * rather than a limitation: the founder pays OpenAI directly at cost, so $29
 * buys the army and the orchestration instead of a margin on tokens. What we
 * pay for is the part that is useless one seat at a time — Telegram,
 * Firecrawl, and the prompts.
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
  /**
   * Credits included per billing period.
   *
   * A unit, not a currency. It meters the services **we** pay for — scraping,
   * search, delivery — not the customer's model spend, which goes on their own
   * key at their provider's price. Deliberately no dollar figure is attached
   * anywhere a customer can see: what a credit costs us is our side of the
   * trade, and a displayed dollar value is a claim that has to survive the
   * customer doing arithmetic on it.
   */
  creditsIncluded: number;
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
    name: "Solo",
    priceUsd: 29,
    agentQuota: 3,
    quotaLabel: "3 squads",
    creditsIncluded: 20_000,
    hosting: "self",
    hostingLine: "Runs on your Vercel account, under your own model key.",
    customAgents: false,
    tagline: "The army, at solo-founder size.",
    features: [
      "Any 3 squads — Research, Content, Hype, whichever you need",
      "Head agent messages you on Telegram morning and evening",
      "You pick the time it reports",
      "20,000 agent credits a month — scraping, search and delivery on us",
      "Bring your own model key, pay the provider at cost",
      "Every squad we ship from now on, included, forever",
      "Cancel in one click, keep everything it made",
    ],
    productId: process.env.NEXT_PUBLIC_DODO_PRODUCT_STARTER,
    highlight: false,
    cta: "Start with 3 squads",
    ctaSubtext: "$29/month. Cancel anytime, in one click.",
  },
  pro: {
    tier: "pro",
    name: "Army",
    priceUsd: 59,
    agentQuota: 6,
    quotaLabel: "All 6 squads",
    creditsIncluded: 60_000,
    hosting: "self",
    hostingLine: "Runs on your Vercel account, under your own model key.",
    customAgents: true,
    tagline: "The whole army, reporting daily.",
    features: [
      "All 6 squads running at once — the full army",
      "Cold Outreach squad: finds leads, scores them, writes each email",
      "Competitor intel every day, not every quarter",
      "60,000 agent credits a month",
      "Weekly strategy summary on top of the twice-daily briefing",
      "Paste any tool URL and we build you an agent for it",
      "Edit the prompt behind every agent",
      "Cancel in one click, keep everything it made",
    ],
    productId: process.env.NEXT_PUBLIC_DODO_PRODUCT_PRO,
    highlight: true,
    cta: "Deploy the whole army",
    ctaSubtext: "$59/month. Less than one afternoon of a freelancer.",
  },
  unlimited: {
    tier: "unlimited",
    name: "Commander",
    priceUsd: 140,
    agentQuota: UNLIMITED_QUOTA,
    quotaLabel: "Unlimited agents",
    creditsIncluded: 200_000,
    hosting: "self",
    hostingLine: "Runs on your own infrastructure. No cap from us on anything.",
    customAgents: true,
    tagline: "No limits, and a commander that answers back.",
    features: [
      "Unlimited agents, and unlimited custom ones",
      "Real-time alerts, not only the morning briefing",
      "Ask the head agent anything on Telegram, any time",
      "Monthly strategy review written against your own numbers",
      "200,000 agent credits a month",
      "Your infrastructure, your keys, no ceiling from us",
      "Every squad we ship from now on, included, forever",
      "Affiliate: 30% recurring for as long as they stay",
    ],
    productId: process.env.NEXT_PUBLIC_DODO_PRODUCT_UNLIMITED,
    highlight: false,
    cta: "Take the commander",
    ctaSubtext: "$140/month. A junior marketer costs 25x this.",
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
  /** Live subscription. Beats everything below it. */
  subscription_status?: string | null;
  /** Instant-access window. Grants the plan until it passes. */
  trial_ends_at?: string | null;
}

export function isAdmin(profile: Entitled | null | undefined): boolean {
  return Boolean(profile?.is_admin);
}

/**
 * Can this account use paid features at all?
 *
 * Three ways in, checked in this order: admin, a live subscription, or an
 * instant-access window that has not closed yet. The order matters — someone
 * who subscribes during their trial must not lose access when the window
 * elapses, so a paid subscription is checked before the clock is.
 *
 * Mirrors `agentstack.is_entitled()` in the database, which is the copy that
 * actually stops things. If you change one, change both.
 */
export function isEntitled(profile: Entitled | null | undefined): boolean {
  if (!profile) return false;
  if (isAdmin(profile)) return true;
  if (!hasPaid(profile.plan)) return false;
  if (profile.subscription_status === "active") return true;

  // A plan with no subscription behind it is a trial: valid until it is not.
  if (profile.trial_ends_at) {
    return new Date(profile.trial_ends_at).getTime() > Date.now();
  }
  // Granted by the payment webhook without a status we recognise — treat the
  // plan itself as the truth rather than locking out a paying customer.
  return true;
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
