import "server-only";
import { createAdminClient } from "./supabase/admin";
import { tokenMatchesHash } from "./crypto";

/**
 * Proving that a request came from a particular deployed agent.
 *
 * The callers here are other deployments, not browsers, so there is no session
 * to read. What there is instead is a per-agent token issued at deploy time
 * and stored only as a hash. The agent id arrives in a header, the token is
 * checked against *that agent's* hash, and everything the request is then
 * allowed to touch is stamped with the ids this function returns — never with
 * anything from the request body.
 *
 * Shared by every agent-facing endpoint so there is one copy of the check.
 * Two copies of an auth check is one copy that will eventually be fixed and
 * one that will not.
 */

export interface AgentIdentity {
  agentId: string;
  userId: string;
  templateId: string;
}

export async function authenticateAgent(
  request: Request,
): Promise<AgentIdentity | null> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const agentId = request.headers.get("x-agent-id") ?? "";

  if (!token || !agentId) return null;

  const admin = createAdminClient();

  const { data: secret } = await admin
    .from("agent_secrets")
    .select("agent_id, user_id, agent_token_hash")
    .eq("agent_id", agentId)
    .maybeSingle<{
      agent_id: string;
      user_id: string;
      agent_token_hash: string | null;
    }>();

  if (!secret?.agent_token_hash) return null;
  if (!tokenMatchesHash(token, secret.agent_token_hash)) return null;

  // The template is needed by anything that reads the shared playbook, and
  // reading it here means no caller ever has to take it from the body.
  const { data: agent } = await admin
    .from("agents")
    .select("template_id")
    .eq("id", secret.agent_id)
    .maybeSingle<{ template_id: string }>();

  return {
    agentId: secret.agent_id,
    userId: secret.user_id,
    templateId: agent?.template_id ?? "",
  };
}
