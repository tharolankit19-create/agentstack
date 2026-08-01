import { decrypt } from "./crypto";
import { createAdminClient } from "./supabase/admin";
import type { Agent } from "./supabase/types";

/**
 * Talking to a customer's deployed agent from the platform.
 *
 * The bearer token never reaches the browser: the dashboard posts to
 * AgentStack, AgentStack decrypts the token and calls the deployment. A
 * customer with devtools open sees their own message and the reply, and no
 * credential that would let them call another agent.
 */

export interface AgentInvocation {
  ok: boolean;
  reply: string;
  generations: { kind: string; content: string; meta?: Record<string, unknown> }[];
  runId?: string;
  error?: string;
}

export async function callAgent(
  agent: Agent,
  path: "/api/chat" | "/api/run" | "/api/schedule",
  body: Record<string, unknown>,
): Promise<AgentInvocation> {
  if (!agent.deploy_url) {
    throw new AgentUnavailableError("This agent is not deployed yet.");
  }
  if (agent.paused) {
    throw new AgentUnavailableError("This agent is stopped. Start it first.");
  }

  const token = await agentToken(agent.id);
  if (!token) {
    throw new AgentUnavailableError(
      "This agent has no deploy token. Redeploy it to issue a new one.",
    );
  }

  let response: Response;
  try {
    response = await fetch(`${agent.deploy_url.replace(/\/+$/, "")}${path}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      // Agent runs scrape pages and call a model; they are not fast.
      signal: AbortSignal.timeout(240_000),
    });
  } catch (cause) {
    const timedOut = cause instanceof Error && cause.name === "TimeoutError";
    throw new AgentUnavailableError(
      timedOut
        ? "The agent took too long to answer. Try a smaller task."
        : "Could not reach the agent. It may still be building.",
    );
  }

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;

  if (!response.ok) {
    throw new AgentUnavailableError(
      typeof payload.error === "string"
        ? payload.error
        : `The agent returned HTTP ${response.status}.`,
    );
  }

  return {
    ok: payload.ok !== false,
    reply:
      typeof payload.reply === "string"
        ? payload.reply
        : typeof payload.output === "string"
          ? payload.output
          : "",
    generations: Array.isArray(payload.generations)
      ? (payload.generations as AgentInvocation["generations"])
      : [],
    runId: typeof payload.runId === "string" ? payload.runId : undefined,
    error: typeof payload.error === "string" ? payload.error : undefined,
  };
}

async function agentToken(agentId: string): Promise<string | null> {
  const { data } = await createAdminClient()
    .from("agent_secrets")
    .select("agent_token_enc")
    .eq("agent_id", agentId)
    .maybeSingle<{ agent_token_enc: string | null }>();

  if (!data?.agent_token_enc) return null;
  try {
    return decrypt(data.agent_token_enc);
  } catch (cause) {
    console.error("[agent-client] could not decrypt agent token:", cause);
    return null;
  }
}

export class AgentUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentUnavailableError";
  }
}
