import { createAdminClient } from "./supabase/admin";
import { PLANS, type Plan } from "./plans";
import type { PlanTier, Profile } from "./supabase/types";

/**
 * Instant activation, for a fixed window.
 *
 * Clicking a plan turns it on right now instead of sending someone to a
 * checkout form they have not decided on. They get the real product — real
 * deploys, real agents — and when the window closes they are back to nothing
 * until they pay.
 *
 * Two things keep this from being a giveaway:
 *
 *   1. **One per account, ever.** `trial_started_at` is written once and never
 *      cleared, and the grant refuses when it is already set. Without that,
 *      "start trial" is a free subscription with extra clicks.
 *   2. **The database enforces the expiry.** `enforce_agent_quota` re-derives
 *      entitlement from these columns on every insert, so an expired trial
 *      cannot create an agent even if every check in this app were bypassed.
 *      The countdown in the UI is a courtesy; the fuse is in Postgres.
 *
 * Length is configurable because "an hour" is a growth guess, not a law, and
 * changing it should not be a deploy of new logic.
 */

/**
 * One day, not one hour.
 *
 * An hour was long enough to look at the product and nowhere near long enough
 * to see it work — the squads run on schedules, so the first real output can
 * land the next morning. A trial that expires before the thing it is
 * demonstrating has happened is a demo of an empty dashboard.
 */
export const TRIAL_MINUTES = Math.max(
  5,
  Number(process.env.INSTANT_TRIAL_MINUTES ?? 1440) || 1440,
);

/** "1 day" / "6 hours" / "45 minutes", for copy that should not say 1440. */
export function trialLengthLabel(): string {
  if (TRIAL_MINUTES % 1440 === 0) {
    const days = TRIAL_MINUTES / 1440;
    return days === 1 ? "1 day" : `${days} days`;
  }
  if (TRIAL_MINUTES % 60 === 0) {
    const hours = TRIAL_MINUTES / 60;
    return hours === 1 ? "1 hour" : `${hours} hours`;
  }
  return `${TRIAL_MINUTES} minutes`;
}

/** Off switch. When this is false the plan buttons go back to checkout. */
export const TRIAL_ENABLED = process.env.NEXT_PUBLIC_INSTANT_TRIAL !== "off";

export interface TrialState {
  /** A trial is running right now. */
  active: boolean;
  /** They had one and it ran out. This is the state that must convert. */
  expired: boolean;
  /** They have never started one, and the feature is on. */
  available: boolean;
  endsAt: string | null;
  msRemaining: number;
}

export function trialState(profile: {
  plan: PlanTier;
  trial_started_at?: string | null;
  trial_ends_at?: string | null;
  subscription_status?: string | null;
}): TrialState {
  const endsAt = profile.trial_ends_at ?? null;
  const started = Boolean(profile.trial_started_at);
  const paid = profile.subscription_status === "active";

  const msRemaining = endsAt ? new Date(endsAt).getTime() - Date.now() : 0;
  // A paid subscription makes the trial irrelevant rather than expired —
  // otherwise someone who converts during their hour gets a "your trial ended"
  // banner for the rest of the month.
  const active = !paid && Boolean(endsAt) && msRemaining > 0;
  const expired = !paid && started && msRemaining <= 0;

  return {
    active,
    expired,
    available: TRIAL_ENABLED && !started && !paid,
    endsAt,
    msRemaining: Math.max(msRemaining, 0),
  };
}

/** True when this profile may use paid features because of a live trial. */
export function trialGrantsAccess(profile: {
  plan: PlanTier;
  trial_started_at?: string | null;
  trial_ends_at?: string | null;
  subscription_status?: string | null;
}): boolean {
  return profile.plan !== "none" && trialState(profile).active;
}

export class TrialError extends Error {}

/**
 * Turns a plan on for the trial window.
 *
 * Service role, because the columns it writes are pinned by RLS — which is the
 * point: a customer cannot hand themselves a plan from the browser.
 */
export async function startTrial(
  userId: string,
  tier: Exclude<PlanTier, "none">,
): Promise<{ profile: Profile; plan: Plan }> {
  if (!TRIAL_ENABLED) {
    throw new TrialError("Instant access is not available right now.");
  }

  const plan = PLANS[tier];
  const admin = createAdminClient();

  const { data: current } = await admin
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle<Profile>();

  if (!current) throw new TrialError("Profile not found.");
  if (current.subscription_status === "active") {
    throw new TrialError("You are already subscribed.");
  }
  if (current.trial_started_at) {
    throw new TrialError(
      "Your trial is already used. Pick a plan to keep going.",
    );
  }

  const now = new Date();
  const ends = new Date(now.getTime() + TRIAL_MINUTES * 60_000);

  const { data, error } = await admin
    .from("profiles")
    .update({
      plan: tier,
      agent_quota: plan.agentQuota,
      trial_started_at: now.toISOString(),
      trial_ends_at: ends.toISOString(),
    })
    .eq("id", userId)
    // Belt and braces against a double-click racing itself into two grants.
    .is("trial_started_at", null)
    .select("*")
    .single<Profile>();

  if (error || !data) {
    throw new TrialError("Could not start that. Try again.");
  }

  return { profile: data, plan };
}
