import "server-only";
import { createAdminClient } from "./supabase/admin";
import { isEntitled } from "./plans";

/**
 * Is this user allowed to have their agents actually work — right now?
 *
 * The dashboard already gates deploy and configure through `requireOperatorApiUser`,
 * but the two places where agents do work on the founder's behalf — the Telegram
 * webhook and the platform crons — run server-side with the service role and
 * never saw an entitlement check. So a founder whose one-day trial had lapsed
 * kept chatting with the head agent, kept getting briefings, kept having
 * scheduled tasks run. That is the product, for free, forever.
 *
 * This is the single check both of those paths now call. It re-derives
 * entitlement from the live profile — admin, active subscription, or an unspent
 * trial window — exactly as the UI does, so "your trial ended" means the same
 * thing everywhere.
 */
export async function userEntitled(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<boolean> {
  const { data } = await admin
    .from("profiles")
    .select("plan, is_admin, subscription_status, trial_ends_at")
    .eq("id", userId)
    .maybeSingle<{
      plan: "none" | "starter" | "pro" | "unlimited";
      is_admin: boolean | null;
      subscription_status: string | null;
      trial_ends_at: string | null;
    }>();

  return isEntitled(data ?? null);
}
