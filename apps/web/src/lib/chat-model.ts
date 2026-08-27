import "server-only";
import { openSecrets } from "./crypto";
import { createAdminClient } from "./supabase/admin";
import { getTemplate } from "./templates";
import { displayName, memberFor, HEAD_AGENT } from "./army";
import { OPENROUTER_BASE, FREE_MODELS, platformModelKey } from "./model-config";
import { personaFor, STYLE_CONTRACT } from "./personas";
import { houseModelKey } from "./connectors";
import { wantsResearch, gatherLiveResearch } from "./research";
import { markWorking } from "./agent-activity";
import { wikiBlock } from "./wiki";
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
  // Env var first, then the key the owner connected in the product, then the
  // founder's own. The middle step is what stops a missing Vercel variable from
  // silently disabling every agent on the platform.
  const platform = platformModelKey();
  if (platform) return platform;

  const house = await houseModelKey(createAdminClient());
  if (house) return house;

  const own = await founderKeyFor(agentId);
  if (own) return own;

  // Nothing of its own — borrow the founder's key from whichever of their
  // agents has one.
  //
  // This is the bug that made the whole product feel like a chatbot. The head
  // agent was created with the founder's key, so chatting with it worked; every
  // other agent was created without one, so the scheduled worker looked up a
  // key, found none, and skipped them. The squads therefore only ever "worked"
  // when someone talked to them, which is exactly the opposite of the promise.
  // One founder, one key, every agent.
  return founderAnyKey(agentId);
}

/**
 * Any model key this agent's owner has, from any of their agents.
 *
 * Keyed off the agent rather than the user id because every caller already has
 * an agent in hand, and it saves threading an owner through six call sites.
 */
export async function founderAnyKey(agentId: string): Promise<string | null> {
  const admin = createAdminClient();

  const { data: owner } = await admin
    .from("agents")
    .select("user_id")
    .eq("id", agentId)
    .maybeSingle<{ user_id: string }>();
  if (!owner?.user_id) return null;

  const { data: rows } = await admin
    .from("agent_secrets")
    .select("ciphertext")
    .eq("user_id", owner.user_id)
    .limit(30);

  for (const row of (rows ?? []) as { ciphertext: string | null }[]) {
    if (!row.ciphertext) continue;
    try {
      const key = openSecrets(row.ciphertext)[MODEL_KEY];
      if (key) return key;
    } catch {
      // An envelope we cannot open is one more to skip, not a failure.
    }
  }
  return null;
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

/**
 * Strip the model's own thinking out of what the founder reads.
 *
 * Free models are chatty about their process: given a job they often answer
 * with "Here's a thinking process:" followed by a numbered analysis of the
 * prompt, and only then the actual work. Stored straight into the dashboard,
 * that reads exactly like the AI slop this product is supposed to replace — the
 * founder sees the machinery instead of the deliverable.
 *
 * So the reply is cut back to the deliverable: a leading reasoning block is
 * dropped, and the common wrappers around it go with it. Deliberately
 * conservative — if nothing recognisable is found, the reply is returned
 * untouched rather than risk truncating real work.
 */
export function stripReasoning(raw: string): string {
  let text = raw.trim();

  // Models that emit explicit thinking tags.
  text = text.replace(/<(think|thinking|reasoning)>[\s\S]*?<\/\1>/gi, "").trim();

  // Tool-call syntax from models that assume a tool loop they were never given.
  // Left in, it reaches the founder as literal "<|tool_call_start|>[google(...)]".
  text = text
    .replace(/<\|tool_call_start\|>[\s\S]*?<\|tool_call_end\|>/gi, "")
    .replace(/<\|[a-z_]+\|>/gi, "")
    .trim();

  // An explicit hand-off marker wins over everything before it.
  const marker = text.match(
    /(?:^|\n)\s*(?:final answer|final output|final version|here'?s the (?:post|draft|result|report|answer)|output)\s*[::-]\s*\n?([\s\S]+)$/i,
  );
  if (marker?.[1] && marker[1].trim().length > 40) {
    return marker[1].trim();
  }

  // Otherwise drop the reasoning blocks off the front.
  //
  // These models don't emit one tidy preamble — they emit a numbered walk
  // through the prompt ("1. Analyze User Input", "2. Check My State", …), so
  // cutting only the first block just resumes the transcript at step two. Work
  // block by block instead and keep the first one that looks like the actual
  // deliverable.
  const isReasoning = (block: string): boolean => {
    const b = block.trim();
    return (
      /^\d+[.)]\s/.test(b) ||
      /^[-*]\s*\*\*(?:analy|check|understand|identif|consider|plan|review|draft|recall|note)/i.test(b) ||
      /^\*\*(?:analy|check|understand|identif|consider|plan|review|recall|step)/i.test(b) ||
      /^(here'?s? (a|my) (thinking|thought) process|let me (think|start|see)|okay,? (let|so)|thinking through|my reasoning|reasoning|analysis)\b/i.test(b) ||
      /user (says|input|wants|asked)\s*:/i.test(b) ||
      /^i am [A-Z]\w+, /i.test(b)
    );
  };

  const blocks = text.split(/\n\s*\n/);
  let first = 0;
  while (first < blocks.length && isReasoning(blocks[first])) first += 1;

  if (first > 0 && first < blocks.length) {
    const rest = blocks.slice(first).join("\n\n").trim();
    if (rest.length > 40) return rest;
  }

  return text.trim() || raw.trim();
}

/**
 * Whether a reply is worth showing a human.
 *
 * Small free models fail in a recognisable way: instead of doing the job they
 * emit a tool call for a search tool they were never given, or hand back
 * nothing but their own commentary. Stored, that reaches the founder as
 * "<|tool_call_start|>[google(query=...)]" — which is worse than no output at
 * all, because it looks like the product is broken rather than quiet. When this
 * says a reply is unusable the caller tries the next model instead.
 */
export function looksUnusable(text: string): boolean {
  const t = text.trim();
  if (t.length < 25) return true;

  // Tool-call syntax, in the shapes these models emit it.
  if (/<\|tool_call|tool_call_start|<\|python_tag\|>/i.test(t)) return true;
  if (/^\s*\[?\s*(?:google|search|browse|web_search)\s*\(/i.test(t)) return true;

  // Nothing but a refusal to work without tools.
  if (/^(i (don'?t|do not) have|i cannot|i can'?t) (access|browse|search)/i.test(t)) {
    return true;
  }

  return false;
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
      const cleaned = stripReasoning(data.choices?.[0]?.message?.content ?? "");
      if (cleaned && !looksUnusable(cleaned)) return cleaned;
      lastError = new ChatModelError(
        cleaned
          ? `Model "${model}" replied with tool calls instead of doing the work.`
          : "The model returned an empty reply.",
      );
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

/**
 * Answer as this agent — researching first when the question calls for it.
 *
 * This is the path both chats (Telegram and the dashboard) run through, so they
 * behave identically. When the founder asks for something that benefits from
 * current signal — a post, a competitor take, a trend — the agent actually goes
 * and looks: it pulls live research on the founder's own Firecrawl/X keys and
 * folds it into the prompt, so the reply is written from this week rather than
 * from the model's memory. And it announces the work as it goes, so the
 * dashboard can show the founder which agents are moving and the head agent
 * conducting them.
 *
 * Research is best-effort: if there is no key, or the lookup finds nothing, the
 * agent answers from what it knows instead of stalling.
 */
export async function respondAsAgent(
  agent: Agent,
  turns: ChatTurn[],
  apiKey: string,
): Promise<string> {
  const admin = createAdminClient();
  const latest = [...turns].reverse().find((t) => t.role === "user")?.content ?? "";
  const isHead = agent.template_id === HEAD_AGENT.id;

  let system = await systemPromptFor(agent);

  // What the team already knows. Chat and the scheduled runs read the same
  // cookbook, so asking an agent in chat continues the same body of work rather
  // than starting a parallel one that forgets everything overnight.
  const known = await wikiBlock(admin, agent.user_id);
  if (known) system += `\n\n${known}`;

  if (latest && wantsResearch(latest)) {
    // The head agent is holding the conversation; the research role goes digging.
    await markWorking(
      admin,
      agent.user_id,
      agent.template_id,
      isHead ? "reading you and pulling the team in" : "on it",
      50,
      agent.id,
    );
    await markWorking(
      admin,
      agent.user_id,
      "research-agent",
      "digging up the latest in your niche",
      50,
    );

    // Bound the lookup: the founder is often waiting on Telegram, which retries
    // if we take too long. Better a fast answer without research than a slow one
    // that Telegram delivers twice. If it times out, we just answer from memory.
    const research = await Promise.race([
      gatherLiveResearch(admin, agent.user_id, agent.config ?? {}, latest),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 22_000)),
    ]);
    if (research?.used) {
      system +=
        "\n\nLIVE RESEARCH you just went and pulled — minutes old, real, specific to " +
        "this founder's market. Write from THIS, not from memory. Name the actual " +
        "things in it; do not paste it back or say 'according to my research'. If it " +
        "changes what you'd say, let it:\n" +
        research.text;
      // Something to write from — the writer takes over.
      await markWorking(
        admin,
        agent.user_id,
        "content-agent",
        "shaping it into a draft",
        50,
      );
    }
  } else if (latest) {
    await markWorking(admin, agent.user_id, agent.template_id, "on it", 25, agent.id);
  }

  return chatComplete(apiKey, system, turns);
}
