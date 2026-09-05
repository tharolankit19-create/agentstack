import type { PlanTier } from "./supabase/types";

/**
 * The legacy plans, kept because people bought them.
 *
 * The product is pay-as-you-go now: credits are bought in packs, spent per
 * action, and never expire (`lib/credits.ts`, migration 0019). There is no
 * monthly commitment to make and no tier to pick, so nothing on the pricing
 * page sells these any more.
 *
 * They stay in the codebase for one reason — accounts that subscribed before
 * credits shipped are still owed what they paid for, and `isEntitled` below
 * checks for them. Do not add a fourth. Do not gate a new feature on a tier:
 * under credits the only question that means anything is whether the founder
 * has a balance, and every agent, squad and custom build is available to
 * anyone who does.
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
    hosting: "managed",
    hostingLine: "We run it for you. Point it at your own VPS instead, any time.",
    customAgents: false,
    tagline: "The army, at solo-founder size.",
    features: [
      "Any 3 squads — Research, Content, Hype, whichever you need",
      "Head agent messages you on Telegram morning and evening",
      "You pick the time it reports",
      "20,000 agent credits a month — scraping, search and delivery on us",
      "Runs on our free models — or bring your own key, at cost",
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
    hosting: "managed",
    hostingLine: "We run it for you. Point it at your own VPS instead, any time.",
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
    hosting: "managed",
    hostingLine: "We run it for you, with no cap on anything. Self-host if you prefer.",
    customAgents: true,
    tagline: "No limits, and a commander that answers back.",
    features: [
      "Unlimited agents, and unlimited custom ones",
      "Real-time alerts, not only the morning briefing",
      "Ask the head agent anything on Telegram, any time",
      "Monthly strategy review written against your own numbers",
      "200,000 agent credits a month",
      "Your choice of infrastructure, and no ceiling from us",
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
  /**
   * Credits bought and not yet spent. **The gate**, since the product went
   * pay-as-you-go — everything below it is legacy.
   */
  credit_balance?: number | null;
  /** Live subscription. Legacy: nobody new gets one. */
  subscription_status?: string | null;
  /** Instant-access window. Legacy. */
  trial_ends_at?: string | null;
}

export function isAdmin(profile: Entitled | null | undefined): boolean {
  return Boolean(profile?.is_admin);
}

/**
 * Can this account actually *operate* — deploy agents, add keys, run things?
 *
 * Open to everyone now, but gated on the trial: a new signup explores freely,
 * and the moment they try to deploy they start a real, payment-backed one-day
 * trial. Once that (or a subscription, or admin) is live they operate. So this
 * is exactly entitlement — the showcase is what a not-yet-entitled visitor
 * sees, and "Start free trial" is the one thing that flips it.
 */
export function canOperate(profile: Entitled | null | undefined): boolean {
  return isEntitled(profile);
}

/** The inverse, named for the thing the UI actually branches on. */
export function isExploreOnly(profile: Entitled | null | undefined): boolean {
  return !canOperate(profile);
}

/**
 * Can this account use paid features at all?
 *
 * Under pay-as-you-go this is a balance question: admin, or credits left to
 * spend. The subscription and trial clauses below it are kept for the accounts
 * that bought a plan before credits shipped, and checked last so that a lapsed
 * legacy trial with credits in it is still entitled.
 *
 * Mirrors `agentstack.is_entitled()` in the database, which is the copy that
 * actually stops things. If you change one, change both.
 */
export function isEntitled(profile: Entitled | null | undefined): boolean {
  if (!profile) return false;
  if (isAdmin(profile)) return true;

  // The pay-as-you-go answer, and the only one that applies to anyone who
  // signed up after credits shipped: they have credits, so they may spend
  // them. A new account arrives with the signup balance, which means it is
  // entitled from its first second — nothing to buy before seeing it work.
  if ((profile.credit_balance ?? 0) > 0) return true;

  // Everything below is for accounts that bought a subscription before credits
  // existed. They are still owed what they paid for.
  if (!hasPaid(profile.plan)) return false;
  if (profile.subscription_status === "active") return true;
  if (profile.trial_ends_at) {
    return new Date(profile.trial_ends_at).getTime() > Date.now();
  }
  return true;
}

/**
 * Can this account build agents from arbitrary tool URLs?
 *
 * Anyone with credits. Building one costs credits like everything else, so
 * putting a tier in front of it would be charging twice for the same action —
 * and the tier it used to require is one nobody can buy any more.
 */
export function canBuildCustom(profile: Entitled | null | undefined): boolean {
  if (!profile) return false;
  return isEntitled(profile) || canBuildCustomAgents(profile.plan);
}

/** How many agents this account may run. Admins are uncapped. */
export function quotaFor(profile: Entitled & { agent_quota?: number }): number {
  if (isAdmin(profile)) return UNLIMITED_QUOTA;
  return profile.agent_quota ?? quotaForTier(profile.plan);
}

/**
 * Does this account host its own agents, or do we host them?
 *
 * We do. That is the product: the founder signs up and twenty-five agents are
 * already running on our infrastructure, on our keys. This returns true only
 * for the legacy self-hosting tiers, which is to say never, for anyone who
 * signed up after credits — an account on no plan is a hosted account, not an
 * unconfigured one, and the old reading of that put a "deploy this yourself"
 * card in front of every new signup.
 */
export function hostsOwnAgents(profile: Entitled): boolean {
  if (profile.plan === "none") return false;
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
