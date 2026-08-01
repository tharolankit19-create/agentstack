import { createClient } from "@supabase/supabase-js";
import { requiredEnv } from "./server";

/**
 * Service-role client. Bypasses RLS, so it is the only way to reach
 * `agent_secrets`, grant a plan after payment, or write a run reported by a
 * deployed agent.
 *
 * Only ever import this from a Route Handler or Server Action. The key it
 * reads is not `NEXT_PUBLIC_`, so a Client Component that imports this fails
 * at runtime rather than shipping the key to the browser — but the rule is
 * still yours to keep.
 */
export function createAdminClient() {
  return createClient(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { "x-agentstack-origin": "server" } },
    },
  );
}
