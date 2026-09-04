import "server-only";
import { createAdminClient } from "./supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

/**
 * What each action costs, and where the margin lives.
 *
 * Credits are a unit, not a currency. A founder sees "a lead search costs 25
 * credits" and "1,000 credits is $12" — both true, both checkable. What a
 * credit costs *us* is the spread, and it is written down here rather than
 * being folded invisibly into a subscription, because a metered product whose
 * unit economics nobody wrote down is one that loses money quietly.
 *
 * The numbers below are set against real upstream prices with roughly a 3×
 * markup. That multiple is not greed: an action can fail and be retried, a
 * provider can raise prices mid-month, and the platform absorbs both. A 1.2×
 * margin would make a bad week cost us money.
 *
 * The rule when adding an action: price the *worst* realistic case, not the
 * average. An action that usually costs a tenth of a cent and occasionally
 * costs five is a five-cent action.
 */

/** One credit is worth this to a customer at the entry pack, in US cents. */
export const CENTS_PER_CREDIT_ENTRY = 1.2;

export type { Metered } from "./credits-public";
export {
  COST,
  PACKS,
  centsPerCredit,
  savingPercent,
  packShape,
} from "./credits-public";

import { COST, type Metered } from "./credits-public";

export interface SpendResult {
  ok: boolean;
  /** The balance after spending, or the current balance when refused. */
  balance: number;
}

/**
 * Charge for an action, atomically.
 *
 * Returns `ok: false` when the founder cannot afford it, and the caller must
 * not do the work — not do it and skip the charge, which is how a metered
 * product ends up giving away its most expensive calls to exactly the accounts
 * that ran out.
 *
 * The check and the decrement happen in one statement inside the database.
 * Read-then-write would leave a window where a founder on their last credits
 * pays for one lead search and receives two.
 */
export async function spend(
  admin: Admin,
  userId: string,
  action: Metered,
  agentId?: string,
): Promise<SpendResult> {
  const credits = COST[action];

  const { data, error } = await admin.rpc("spend_credits", {
    p_user_id: userId,
    p_credits: credits,
    p_service: serviceOf(action),
    p_action: action,
    p_agent_id: agentId ?? null,
  });

  if (error || typeof data !== "number") {
    // A metering failure must not become a free-work loophole. If we cannot
    // record the charge we do not do the work.
    console.error("[credits] spend failed:", error?.message);
    return { ok: false, balance: 0 };
  }

  return data < 0 ? { ok: false, balance: 0 } : { ok: true, balance: data };
}

/** Which upstream this action bills against, for the itemised view. */
function serviceOf(action: Metered): string {
  if (action === "web_search" || action === "page_read") return "firecrawl";
  if (action === "draft" || action === "briefing") return "model";
  if (action === "email_send") return "resend";
  return "monid";
}

/** The founder's balance. Zero when the profile has not been read yet. */
export async function balanceOf(admin: Admin, userId: string): Promise<number> {
  const { data } = await admin
    .from("profiles")
    .select("credit_balance")
    .eq("id", userId)
    .maybeSingle<{ credit_balance: number }>();

  return data?.credit_balance ?? 0;
}

/**
 * Whether there is enough for an action, without charging.
 *
 * For the places that need to decide whether to *offer* something — a cron
 * skipping an account that cannot pay, rather than attempting and failing at
 * every tick.
 */
export async function canAfford(
  admin: Admin,
  userId: string,
  action: Metered,
): Promise<boolean> {
  return (await balanceOf(admin, userId)) >= COST[action];
}
