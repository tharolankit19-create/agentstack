import "server-only";
import { createAdminClient } from "./supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

/** 100 Kryx credits = $1 customer-facing. */
export const CENTS_PER_CREDIT_ENTRY = 1;

export type { Metered } from "./credits-public";
export { COST, PACKS, centsPerCredit, savingPercent, packShape } from "./credits-public";
import { COST, type Metered } from "./credits-public";

export interface SpendResult { ok: boolean; balance: number; }

/** Atomically charge a completed specialist action from the prepaid wallet. */
export async function spend(admin: Admin, userId: string, action: Metered, agentId?: string): Promise<SpendResult> {
  const credits = COST[action];
  const { data, error } = await admin.rpc("spend_credits", {
    p_user_id: userId,
    p_credits: credits,
    p_service: serviceOf(action),
    p_action: action,
    p_agent_id: agentId ?? null,
  });
  if (error || typeof data !== "number") {
    console.error("[credits] spend failed:", error?.message);
    return { ok: false, balance: 0 };
  }
  return data < 0 ? { ok: false, balance: 0 } : { ok: true, balance: data };
}

function serviceOf(action: Metered): string {
  if (action === "web_search" || action === "page_read") return "firecrawl";
  if (action === "draft" || action === "briefing") return "model";
  if (action === "email_send") return "resend";
  return "monid";
}

export async function balanceOf(admin: Admin, userId: string): Promise<number> {
  const { data } = await admin.from("profiles").select("credit_balance").eq("id", userId).maybeSingle<{ credit_balance: number }>();
  return data?.credit_balance ?? 0;
}

export async function canAfford(admin: Admin, userId: string, action: Metered): Promise<boolean> {
  return (await balanceOf(admin, userId)) >= COST[action];
}
