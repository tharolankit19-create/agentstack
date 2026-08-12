import "server-only";
import { openSecrets } from "./crypto";
import { createAdminClient } from "./supabase/admin";
import { getTemplate } from "./templates";
import { displayName, memberFor, HEAD_AGENT } from "./army";
import { OPENROUTER_BASE, FREE_MODELS, platformModelKey } from "./model-config";
import { personaFor, STYLE_CONTRACT } from "./personas";
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

const MODEL_KEY = "OPENAI_API_KEY";

export class ChatModelError extends Error {}

/**
 * The key chat should run on.
 *
 * Prefers the platform's own key so a founder's chatting never spends their
 * quota — chat is unlimited and free to them. Only if the platform has no key
 * configured does it fall back to the founder's own, so chat still works on a
 * self-serve deploy that has not set a platform key.
 */
export async function chatKeyFor(agentId: string): Promise<string | null> {
  const platform = platformModelKey();
  if (platform) return platform;
  return founderKeyFor(agentId);
}

/** The founder's own model key for this agent, or null if none is stored. */
export async function founderKeyFor(agentId: string): Promise<string | null> {
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
  const persona = personaFor(agent.template_id);
  const config = agent.config ?? {};

  const context = [
    config.businessContext,
    config.websiteUrl ? `Website: ${config.websiteUrl}` : null,
    config.icp ? `Their customer: ${config.icp}` : null,
    config.competitors ? `Competitors: ${config.competitors}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const lines = [
    // Identity first — the name and the character, before anything procedural.
    `Your name is ${name}. You are the ${role} on the founder's marketing team.`,
    persona.character,
  ];

  // How this agent does its job well — the craft that stops it being generic.
  if (persona.craft) {
    lines.push("", `How you do your job:`, persona.craft);
  }

  lines.push("", STYLE_CONTRACT);

  if (context) {
    lines.push("", "About the business you work for:", context);
  } else {
    lines.push(
      "",
      "You don't have the business details yet. If you need them to answer well,",
      "ask the founder one short question rather than making things up.",
    );
  }

  // The head agent is the one that reports on everyone else, so give it the
  // material to do that — and tell it to brief, not to list.
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
        "What your squads produced recently. When the founder asks what happened,",
        "give them the two or three things that actually matter — not a list of",
        "all of it:",
        ...rows.map((r) => `- [${r.kind}] ${r.content.slice(0, 180)}`),
      );
    } else {
      lines.push(
        "",
        "Your squads haven't produced anything yet. If the founder asks what",
        "happened, tell them that straight — nothing overnight yet — and in one",
        "line what they'll start seeing once the squads are deployed. Don't invent",
        "activity.",
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
  const messages = [{ role: "system", content: system }, ...history];

  // Try the free models in order. A `:free` model can be busy or briefly
  // pulled, and one being unavailable should fall through to the next rather
  // than fail the whole message — the founder does not know or care which
  // free model answered.
  let lastError: ChatModelError | null = null;

  for (const model of FREE_MODELS) {
    let response: Response;
    try {
      response = await fetch(`${OPENROUTER_BASE.replace(/\/+$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
          // OpenRouter asks callers to identify themselves; harmless elsewhere.
          "HTTP-Referer": "https://marketingagentsarmy.com",
          "X-Title": "Marketing Agents Army",
        },
        body: JSON.stringify({
          model,
          temperature: 0.5,
          max_tokens: 1200,
          messages,
        }),
        signal: AbortSignal.timeout(90_000),
      });
    } catch (cause) {
      const timedOut = cause instanceof Error && cause.name === "TimeoutError";
      lastError = new ChatModelError(
        timedOut ? "The model took too long to answer." : "Could not reach the model.",
      );
      continue;
    }

    if (response.ok) {
      const data = (await response.json().catch(() => ({}))) as {
        choices?: { message?: { content?: string } }[];
      };
      const reply = data.choices?.[0]?.message?.content?.trim();
      if (reply) return reply;
      lastError = new ChatModelError("The model returned an empty reply.");
      continue;
    }

    const body = (await response.json().catch(() => ({}))) as {
      error?: { message?: string } | string;
    };
    const providerMsg =
      typeof body.error === "string" ? body.error : body.error?.message ?? "";

    // A rejected key is fatal for every model — no point trying the rest.
    if (response.status === 401 || response.status === 402 || response.status === 403) {
      throw new ChatModelError(
        `The chat model key was rejected${providerMsg ? ` (${providerMsg})` : ""}. ` +
          "Set a working OpenRouter key in the OPENROUTER_API_KEY environment variable.",
      );
    }

    // 404 (this model not on the account), 429 (rate-limited), 5xx (busy):
    // remember it and try the next free model.
    lastError = new ChatModelError(
      providerMsg || `Model "${model}" was unavailable (${response.status}).`,
    );
  }

  throw (
    lastError ??
    new ChatModelError("No chat model is configured. Set CHAT_MODELS and OPENROUTER_API_KEY.")
  );
}
