import "server-only";
import { openSecrets } from "./crypto";
import { createAdminClient } from "./supabase/admin";
import { getTemplate } from "./templates";
import { displayName, memberFor, HEAD_AGENT } from "./army";
import type { Agent } from "./supabase/types";

/**
 * Chatting with an agent, run on the server.
 *
 * The old chat path forwarded every message to the agent's *deployed* URL and
 * proxied the reply back. That coupled the whole feature to a live deployment,
 * a matching bearer token and a reachable function — and when any of those was
 * off it surfaced as "the agent returned HTTP 401" with nothing the founder
 * could do about it. Chatting with your own head agent should not require it to
 * be deployed first.
 *
 * So this calls the model directly, with the founder's own key, through an
 * OpenAI-compatible endpoint (OpenRouter by default). The key never touches the
 * browser: it is decrypted here, used once, and dropped.
 *
 * The model defaults to NVIDIA's Nemotron on OpenRouter. Both the endpoint and
 * the model are env-overridable so a founder on a different provider is not
 * stuck with a slug that does not exist on their account.
 */

const BASE_URL =
  process.env.OPENROUTER_BASE_URL?.trim() ||
  process.env.OPENAI_BASE_URL?.trim() ||
  "https://openrouter.ai/api/v1";

const CHAT_MODEL =
  process.env.CHAT_MODEL?.trim() || "nvidia/llama-3.1-nemotron-ultra-253b-v1";

const MODEL_KEY = "OPENAI_API_KEY";

export class ChatModelError extends Error {}

/** The founder's model key for this agent, or null if none is stored. */
export async function modelKeyFor(agentId: string): Promise<string | null> {
  const { data } = await createAdminClient()
    .from("agent_secrets")
    .select("ciphertext")
    .eq("agent_id", agentId)
    .maybeSingle<{ ciphertext: string }>();

  if (!data?.ciphertext) return null;
  try {
    return openSecrets(data.ciphertext)[MODEL_KEY] ?? null;
  } catch {
    return null;
  }
}

/**
 * The system prompt for a chat turn.
 *
 * Built from the agent's identity and the founder's business context rather
 * than the deployed prompt files, which the web app does not carry. For the
 * head agent it also folds in what the squads recently produced, so "what did
 * the squads do overnight?" has a real answer instead of a shrug.
 */
export async function systemPromptFor(agent: Agent): Promise<string> {
  const template = getTemplate(agent.template_id);
  const name = displayName(agent.template_id, agent.name, template?.name);
  const role = memberFor(agent.template_id)?.role ?? template?.name ?? "agent";
  const config = agent.config ?? {};

  const context = [
    config.businessContext,
    config.websiteUrl ? `Website: ${config.websiteUrl}` : null,
    config.icp ? `Customer: ${config.icp}` : null,
    config.competitors ? `Competitors: ${config.competitors}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const lines = [
    `You are ${name}, the ${role} on a marketing team called Marketing Agents Army.`,
    template?.description ?? "",
    "",
    "You work for the founder you are talking to. Be concise, specific, and do",
    "the thing they ask within your role. You never post to social media or send",
    "email on your own — you prepare drafts and the founder approves them.",
  ];

  if (context) {
    lines.push("", "What you know about this business:", context);
  }

  // The head agent is the one that reports on everyone else, so give it the
  // material to do that.
  if (agent.template_id === HEAD_AGENT.id) {
    const admin = createAdminClient();
    const { data: recent } = await admin
      .from("generations")
      .select("kind, content, created_at")
      .eq("user_id", agent.user_id)
      .order("created_at", { ascending: false })
      .limit(20);

    const rows = (recent ?? []) as { kind: string; content: string }[];
    if (rows.length > 0) {
      lines.push(
        "",
        "What your squads have produced recently (summarise, prioritise, do not",
        "just list):",
        ...rows.map((r) => `- [${r.kind}] ${r.content.slice(0, 200)}`),
      );
    } else {
      lines.push(
        "",
        "Your squads have not produced anything yet — say so honestly and tell",
        "the founder what will happen once their agents are deployed and running.",
      );
    }
  }

  return lines.filter((line) => line !== undefined).join("\n");
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

/**
 * One chat completion. Returns the reply text.
 *
 * Errors are turned into `ChatModelError` with a message written for the
 * founder — a 401 here means "your key was rejected", which is actionable, not
 * "HTTP 401", which is not.
 */
export async function chatComplete(
  apiKey: string,
  system: string,
  history: ChatTurn[],
): Promise<string> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        // OpenRouter asks callers to identify themselves; harmless elsewhere.
        "HTTP-Referer": "https://marketingagentsarmy.com",
        "X-Title": "Marketing Agents Army",
      },
      body: JSON.stringify({
        model: CHAT_MODEL,
        temperature: 0.5,
        max_tokens: 1200,
        messages: [{ role: "system", content: system }, ...history],
      }),
      signal: AbortSignal.timeout(120_000),
    });
  } catch (cause) {
    const timedOut = cause instanceof Error && cause.name === "TimeoutError";
    throw new ChatModelError(
      timedOut
        ? "The model took too long to answer. Try again, or ask something smaller."
        : "Could not reach the model provider. Try again in a moment.",
    );
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      error?: { message?: string } | string;
    };
    const providerMsg =
      typeof body.error === "string"
        ? body.error
        : body.error?.message ?? "";

    if (response.status === 401 || response.status === 402 || response.status === 403) {
      throw new ChatModelError(
        `Your model key was rejected${providerMsg ? ` (${providerMsg})` : ""}. ` +
          "Check it in Settings — for OpenRouter it starts with sk-or-.",
      );
    }
    if (response.status === 404) {
      throw new ChatModelError(
        `The chat model "${CHAT_MODEL}" was not found on your account. ` +
          "Set CHAT_MODEL to one your key can use.",
      );
    }
    if (response.status === 429) {
      throw new ChatModelError("Rate-limited by the provider. Wait a moment and retry.");
    }
    throw new ChatModelError(
      providerMsg || `The model provider returned ${response.status}.`,
    );
  }

  const data = (await response.json().catch(() => ({}))) as {
    choices?: { message?: { content?: string } }[];
  };
  const reply = data.choices?.[0]?.message?.content?.trim();
  if (!reply) {
    throw new ChatModelError("The model returned an empty reply. Try rephrasing.");
  }
  return reply;
}
