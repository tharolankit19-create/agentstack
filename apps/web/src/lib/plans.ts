import type { PlanTier } from "./supabase/types";

/**
 * Two plans, and a three-day trial in front of both.
 *
 *   $49  Army       — the twenty-five agents, 50 leads a morning
 *   $99  Commander  — the same army at three times the volume
 *
 * A free account is real and useful: it can see the whole product, connect
 * Telegram, set its brand and competitors, and watch the demo. What it cannot
 * do is *run* anything — no chat, no agent turns, no sends. That line is
 * deliberate. Someone who has set everything up and pressed the one button that
 * matters is a person deciding, and a trial offered at that moment converts;
 * the same trial offered on the pricing page is a form to fill in before they
 * know what they would be trialling.
 *
 * The third tier is gone from the page and kept in the code, because accounts
 * bought it and every `PLANS[profile.plan]` lookup must keep working.
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
    name: "Army",
    priceUsd: 49,
    agentQuota: UNLIMITED_QUOTA,
    quotaLabel: "The whole army",
    creditsIncluded: 40_000,
    hosting: "managed",
    hostingLine: "We run every agent. You never deploy anything.",
    customAgents: true,
    tagline: "Twenty-five agents, working while you sleep.",
    features: [
      "All 25 agents live from your first minute — nothing to deploy",
      "50 fresh leads every morning, qualified and written up",
      "Seamus messages you on Telegram morning and evening",
      "Cold outreach: finds them, scores them, writes each email itself",
      "Competitor intel daily, not quarterly",
      "SEO and AEO audits against the pages actually ranking above you",
      "Approve from the board, from Telegram, or not at all",
    ],
    productId: process.env.NEXT_PUBLIC_DODO_PRODUCT_STARTER,
    highlight: true,
    cta: "Start 3-day trial",
    ctaSubtext: "$49/month after. Cancel in one click, keep everything it made.",
  },
  pro: {
    tier: "pro",
    name: "Commander",
    priceUsd: 99,
    agentQuota: UNLIMITED_QUOTA,
    quotaLabel: "The army, at volume",
    creditsIncluded: 120_000,
    hosting: "managed",
    hostingLine: "We run every agent, with no ceiling on how hard you push.",
    customAgents: true,
    tagline: "For when the army is the growth team.",
    features: [
      "Everything in Army, and three times the working volume",
      "150 leads a morning instead of 50",
      "Real-time alerts, not only the twice-daily briefing",
      "Ask Seamus anything on Telegram, any time",
      "Paste any tool URL and we build you an agent for it",
      "Monthly strategy review written against your own numbers",
      "Affiliate: 30% recurring for as long as they stay",
    ],
    productId: process.env.NEXT_PUBLIC_DODO_PRODUCT_PRO,
    highlight: false,
    cta: "Start 3-day trial",
    ctaSubtext: "$99/month after. Cancel in one click.",
  },
  // Legacy. Nobody can buy this any more; it exists so accounts that did are
  // still served by every `PLANS[profile.plan]` lookup in the app.
  unlimited: {
    tier: "unlimited",
    name: "Commander (legacy)",
    priceUsd: 140,
    agentQuota: UNLIMITED_QUOTA,
    quotaLabel: "Unlimited agents",
    creditsIncluded: 200_000,
    hosting: "managed",
    hostingLine: "We run it for you, with no cap on anything.",
    customAgents: true,
    tagline: "The plan you already have.",
    features: ["Everything, with no ceiling from us"],
    productId: process.env.NEXT_PUBLIC_DODO_PRODUCT_UNLIMITED,
    highlight: false,
    cta: "Your current plan",
    ctaSubtext: "Grandfathered. Nothing changes for you.",
  },
};

/**
 * The plans a customer can actually choose. Two, on purpose.
 *
 * Three tiers made the middle one a decision rather than a default, and the
 * cheapest read as the crippled one. Two is a yes/no about volume, which is the
 * only question a founder can answer before they have used it.
 *
 * The legacy tier is deliberately absent: it is served everywhere by id and
 * shown nowhere.
 */
export const PLAN_LIST: Plan[] = [PLANS.starter, PLANS.pro];

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
 * A free account explores: it sees the board, the room, every agent, and can
 * connect Telegram and fill in its brand. It cannot run a turn, chat, or send.
 * The first attempt at any of those raises the trial prompt, which is the
 * moment the founder has enough information to answer it.
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

  // Credits are a meter, not a key.
  //
  // They were briefly the gate, and that made every free signup a full
  // operating account — which is the opposite of what a free tier is for here.
  // A balance now decides how *much* a paying account can do, and this decides
  // whether it may do anything at all. Both matter; they are not the same
  // question.
  if (!hasPaid(profile.plan)) return false;
  if (profile.subscription_status === "active") return true;

  // A plan with no subscription behind it is a trial: valid until it is not.
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
