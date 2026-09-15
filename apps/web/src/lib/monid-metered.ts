import "server-only";
import type { createAdminClient } from "./supabase/admin";
import { canAfford, spend, COST, type Metered } from "./credits";
import {
  runCapability,
  type CapabilityId,
  type CapabilityParams,
  type CapabilityResult,
} from "./monid-capabilities";

type Admin = ReturnType<typeof createAdminClient>;

const ACTION_FOR_CAPABILITY: Record<CapabilityId, Metered> = {
  leads: "lead_search",
  email: "email_lookup",
  research: "web_search",
  serp: "rank_check",
  jobs: "web_search",
  company: "web_search",
  social: "social_scan",
  reviews: "review_check",
  page: "page_read",
};

export interface MeteredCapabilityResult extends CapabilityResult {
  chargedCredits: number;
  action: Metered;
}

/**
 * Customer billing boundary for Monid.
 *
 * The platform checks the wallet before spending vendor money, runs the
 * cost-capped capability, and only charges the founder when usable rows came
 * back. Empty searches are our quality risk, not a customer charge.
 */
export async function runMeteredCapability(
  admin: Admin,
  userId: string,
  apiKeys: string | readonly string[],
  capability: CapabilityId,
  params: CapabilityParams,
  options: { budgetMs?: number; agentId?: string } = {},
): Promise<MeteredCapabilityResult> {
  const action = ACTION_FOR_CAPABILITY[capability];

  if (!(await canAfford(admin, userId, action))) {
    return {
      ok: false,
      rows: [],
      via: null,
      cost: 0,
      reason: `Not enough Kryx credits for ${action.replaceAll("_", " ")} (${COST[action]} credits).`,
      keySlot: null,
      chargedCredits: 0,
      action,
    };
  }

  const result = await runCapability(
    apiKeys,
    capability,
    params,
    options.budgetMs ?? 60_000,
  );

  if (!result.ok || result.rows.length === 0) {
    return { ...result, chargedCredits: 0, action };
  }

  const charged = await spend(admin, userId, action, options.agentId);
  if (!charged.ok) {
    return {
      ...result,
      ok: false,
      reason:
        "The lookup completed, but the wallet changed before it could be charged. Add credits and retry.",
      chargedCredits: 0,
      action,
    };
  }

  return {
    ...result,
    chargedCredits: COST[action],
    action,
  };
}
