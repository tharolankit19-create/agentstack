/** Browser-safe KryxAI credit pricing. 100 credits = $1. */

export type Metered =
  | "lead_search"
  | "email_lookup"
  | "web_search"
  | "page_read"
  | "rank_check"
  | "review_check"
  | "social_scan"
  | "draft"
  | "briefing"
  | "email_send";

/**
 * Launch meter. Chat/planning with Kryx is deliberately not metered; credits
 * are spent when a specialist actually does work. Keep these numbers stable
 * enough that founders can predict a bill without understanding model tokens.
 */
export const COST: Record<Metered, number> = {
  // Customer-facing pricing, in cents because 100 credits = $1.
  // These are intentionally above the preferred vendor cost so the platform
  // can absorb empty searches, model/retry overhead and occasional provider
  // fallback without selling data work at cost.
  draft: 5,
  briefing: 3,
  email_send: 3,
  page_read: 3,
  web_search: 6,
  social_scan: 15,
  rank_check: 30,
  review_check: 15,
  email_lookup: 15,
  lead_search: 30,
};

export const CREDITS_PER_DOLLAR = 100;
export const SIGNUP_CREDITS = 100;
export const MIN_TOPUP_USD = 5;
export const TOPUP_STEP_USD = 5;

export function creditsForUsd(usd: number): number {
  return Math.round(usd * CREDITS_PER_DOLLAR);
}

export function usdForCredits(credits: number): number {
  return credits / CREDITS_PER_DOLLAR;
}

/** Preset buttons are convenience only; founders may enter any $5 increment. */
export const PACKS = [5, 10, 25, 50].map((priceUsd) => ({
  id: `usd-${priceUsd}`,
  credits: creditsForUsd(priceUsd),
  priceUsd,
  label: priceUsd === 5 ? "Start working" : priceUsd === 10 ? "Keep momentum" : priceUsd === 25 ? "Launch mode" : "Heavy use",
})) as Array<{ id: string; credits: number; priceUsd: number; label: string }>;

export type PackId = string;

export function packById(id: string) {
  return PACKS.find((pack) => pack.id === id) ?? null;
}

export function centsPerCredit(): number {
  return 1;
}

export function savingPercent(): number {
  return 0;
}

export function packShape(credits: number): string {
  const deepResearch = Math.max(1, Math.floor(credits / 30));
  return `${deepResearch.toLocaleString("en-US")} research-sized jobs, or many smaller agent actions`;
}
