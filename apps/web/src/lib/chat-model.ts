import "server-only";
import { openSecrets } from "./crypto";
import { createAdminClient } from "./supabase/admin";
import { getTemplate } from "./templates";
import { displayName, memberFor, HEAD_AGENT } from "./army";
import { OPENROUTER_BASE, FREE_MODELS, platformModelKey } from "./model-config";
import { routeForAgent, anyArmyModelKey, type ModelCandidate } from "./agent-model-routing";
import { personaFor, STYLE_CONTRACT } from "./personas";
import { houseModelKey } from "./connectors";
import { wantsResearch, gatherLiveResearch } from "./research";
import { markWorking } from "./agent-activity";
import { wikiBlock } from "./wiki";
import { detectAction, runAction, presentationRules } from "./chat-actions";
import type { Agent } from "./supabase/types";

const MODEL_KEY = "OPENAI_API_KEY";

export class ChatModelError extends Error {}

/** Best-effort process-local circuit breaker. Serverless instances may reset it. */
const BENCHED_UNTIL = new Map<string, number>();
const routeKey = (c: ModelCandidate) => `${c.provider}:${c.model}`;

function isBenched(candidate: ModelCandidate): boolean {
  return (BENCHED_UNTIL.get(routeKey(candidate)) ?? 0) > Date.now();
}

function bench(candidate: ModelCandidate, status?: number): void {
  // Short cooldown for busy/rate-limited routes, longer for payment/auth/model
  // configuration failures. This is intentionally scoped to provider+model.
  const long = status === 401 || status === 402 || status === 403 || status === 404;
  BENCHED_UNTIL.set(routeKey(candidate), Date.now() + (long ? 10 * 60_000 : 2 * 60_000));
}

/**
 * A usable model credential for this owner. The actual provider/model is chosen
 * later from the agent's pinned route; this function exists for old callers
 * that only ask "can this agent think?".
 */
export async function chatKeyFor(agentId: string): Promise<string | null> {
  const armyKey = anyArmyModelKey();
  if (armyKey) return armyKey;

  const platform = platformModelKey();
  if (platform) return platform;

  const house = await houseModelKey(createAdminClient());
  if (house) return house;

  const own = await founderKeyFor(agentId);
  if (own) return own;
  return founderAnyKey(agentId);
}

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
      // Skip envelopes that cannot be opened. Another stored key may work.
    }
  }
  return null;
}

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

/** Business context is shared from the head agent unless a specialist overrides it. */
export async function businessConfigFor(agent: Agent): Promise<Record<string, string>> {
  const own = agent.config ?? {};
  const hasContext = Boolean(
    own.businessContext || own.websiteUrl || own.icp || own.competitors || own.companyName,
  );
  if (hasContext || agent.template_id === HEAD_AGENT.id) return own;

  const { data: head } = await createAdminClient()
    .from("agents")
    .select("config")
    .eq("user_id", agent.user_id)
    .eq("template_id", HEAD_AGENT.id)
    .maybeSingle<{ config: Record<string, string> | null }>();

  return { ...(head?.config ?? {}), ...own };
}

export async function systemPromptFor(agent: Agent): Promise<string> {
  const template = getTemplate(agent.template_id);
  const name = displayName(agent.template_id, agent.name, template?.name);
  const role = memberFor(agent.template_id)?.role ?? template?.name ?? "agent";
  const persona = personaFor(agent.template_id);
  const config = await businessConfigFor(agent);

  const context = [
    config.businessContext,
    config.companyName ? `Company: ${config.companyName}` : null,
    config.websiteUrl ? `Website: ${config.websiteUrl}` : null,
    config.icp ? `Customer: ${config.icp}` : null,
    config.competitors ? `Competitors: ${config.competitors}` : null,
    config.xHandle ? `Founder X: @${config.xHandle.replace(/^@/, "")}` : null,
    config.voiceSample ? `Founder voice sample: ${config.voiceSample}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const lines = [
    `Your name is ${name}. You are the ${role} on the founder's marketing team.`,
    persona.character,
  ];

  if (persona.craft) lines.push("", "How you do your job:", persona.craft);
  lines.push("", STYLE_CONTRACT);

  if (context) {
    lines.push("", "Founder/business context:", context);
  } else {
    lines.push(
      "",
      "You do not have enough business context yet. Ask one short question only when the missing fact changes the answer; never fill the gap with invented facts.",
    );
  }

  if (agent.template_id === HEAD_AGENT.id) {
    const { data: recent } = await createAdminClient()
      .from("generations")
      .select("kind, content, created_at")
      .eq("user_id", agent.user_id)
      .order("created_at", { ascending: false })
      .limit(20);

    const rows = (recent ?? []) as { kind: string; content: string }[];
    if (rows.length) {
      lines.push(
        "",
        "Recent team output. Do not list it all; extract the two or three decisions that matter:",
        ...rows.map((r) => `- [${r.kind}] ${r.content.slice(0, 220)}`),
      );
    } else {
      lines.push(
        "",
        "The team has not produced anything yet. Say that plainly if asked; never invent overnight activity.",
      );
    }
  }

  return lines.join("\n");
}

/** Remove hidden-thinking/tool-call artefacts from founder-visible output. */
export function stripReasoning(raw: string): string {
  let text = raw.trim();
  text = text.replace(/<(think|thinking|reasoning)>[\s\S]*?<\/\1>/gi, "").trim();
  text = text
    .replace(/<\|tool_call_start\|>[\s\S]*?<\|tool_call_end\|>/gi, "")
    .replace(/<\|[a-z_]+\|>/gi, "")
    .trim();

  const marker = text.match(
    /(?:^|\n)\s*(?:final answer|final output|final version|here'?s the (?:post|draft|result|report|answer)|output)\s*[::-]\s*\n?([\s\S]+)$/i,
  );
  if (marker?.[1] && marker[1].trim().length > 20) return marker[1].trim();

  const isReasoning = (block: string): boolean => {
    const b = block.trim();
    return (
      /^\d+[.)]\s+(?:analy|check|understand|identif|consider|plan|review|reason)/i.test(b) ||
      /^\*\*(?:analy|check|understand|identif|consider|plan|review|reason|step)/i.test(b) ||
      /^(here'?s? (a|my) (thinking|thought) process|let me (think|start|see)|thinking through|my reasoning|reasoning|analysis)\b/i.test(b) ||
      /user (says|input|wants|asked)\s*:/i.test(b)
    );
  };

  const blocks = text.split(/\n\s*\n/);
  let first = 0;
  while (first < blocks.length && isReasoning(blocks[first])) first += 1;
  if (first > 0 && first < blocks.length) {
    const rest = blocks.slice(first).join("\n\n").trim();
    if (rest.length > 20) return rest;
  }
  return text || raw.trim();
}

export function looksUnusable(text: string): boolean {
  const t = text.trim();
  if (t.length < 12) return true;
  if (/<\|tool_call|tool_call_start|<\|python_tag\|>/i.test(t)) return true;
  if (/^\s*\[?\s*(?:google|search|browse|web_search)\s*\(/i.test(t)) return true;
  if (/^(i (don'?t|do not) have|i cannot|i can'?t) (access|browse|search)/i.test(t)) return true;
  return false;
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

async function callCandidate(
  candidate: ModelCandidate,
  messages: { role: string; content: string }[],
): Promise<{ ok: true; text: string } | { ok: false; status?: number; error: string }> {
  let response: Response;
  try {
    response = await fetch(`${candidate.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${candidate.apiKey}`,
        "content-type": "application/json",
        "HTTP-Referer": "https://marketingagentsarmy.com",
        "X-Title": "Marketing Agents Army",
      },
      body: JSON.stringify({
        model: candidate.model,
        temperature: 0.45,
        max_tokens: 1400,
        messages,
      }),
      signal: AbortSignal.timeout(65_000),
    });
  } catch (cause) {
    const timedOut = cause instanceof Error && (cause.name === "TimeoutError" || cause.name === "AbortError");
    return { ok: false, error: timedOut ? "timed out" : "could not be reached" };
  }

  const data = (await response.json().catch(() => ({}))) as {
    choices?: { message?: { content?: string | { text?: string }[] } }[];
    error?: { message?: string } | string;
    message?: string;
  };

  if (!response.ok) {
    const providerError =
      typeof data.error === "string" ? data.error : data.error?.message ?? data.message ?? "";
    return {
      ok: false,
      status: response.status,
      error: providerError || `HTTP ${response.status}`,
    };
  }

  const raw = data.choices?.[0]?.message?.content;
  const rawText =
    typeof raw === "string"
      ? raw
      : Array.isArray(raw)
        ? raw.map((part) => part?.text ?? "").join("\n")
        : "";
  const cleaned = stripReasoning(rawText);
  if (!cleaned || looksUnusable(cleaned)) {
    return { ok: false, error: cleaned ? "returned unusable tool/reasoning output" : "returned an empty reply" };
  }
  return { ok: true, text: cleaned };
}

/**
 * One completion. When templateId is supplied, the role's pinned provider/model
 * is tried first and stays stable for the whole call. Fallbacks are only used
 * after a concrete failure. Calls without templateId retain the legacy
 * OpenRouter free-model chain for compatibility.
 */
export async function chatComplete(
  apiKey: string,
  system: string,
  history: ChatTurn[],
  templateId?: string,
): Promise<string> {
  const messages = [{ role: "system", content: system }, ...history];
  let lastError = "No model answered.";

  if (templateId) {
    const candidates = routeForAgent(templateId, apiKey);
    for (const candidate of candidates) {
      if (isBenched(candidate)) continue;
      const result = await callCandidate(candidate, messages);
      if (result.ok) return result.text;
      lastError = `${candidate.routeLabel} model ${result.error}`;
      bench(candidate, result.status);
    }
    throw new ChatModelError(`The agent's primary and fallback models are unavailable right now. ${lastError}`);
  }

  // Legacy callers keep the old OpenRouter behaviour.
  for (const model of FREE_MODELS) {
    const candidate: ModelCandidate = {
      provider: "openrouter",
      model,
      baseUrl: OPENROUTER_BASE.replace(/\/+$/, ""),
      apiKey,
      routeLabel: "legacy",
    };
    const result = await callCandidate(candidate, messages);
    if (result.ok) return result.text;
    lastError = result.error;
  }
  throw new ChatModelError(`No chat model answered. ${lastError}`);
}

/** Dashboard + Telegram use the same path, tools and pinned role model. */
export async function respondAsAgent(
  agent: Agent,
  turns: ChatTurn[],
  apiKey: string,
): Promise<string> {
  const admin = createAdminClient();
  const latest = [...turns].reverse().find((t) => t.role === "user")?.content ?? "";
  const isHead = agent.template_id === HEAD_AGENT.id;
  let system = await systemPromptFor(agent);

  const known = await wikiBlock(admin, agent.user_id);
  if (known) system += `\n\n${known}`;

  const action = latest ? detectAction(latest) : null;
  if (action) {
    await markWorking(
      admin,
      agent.user_id,
      action.kind === "leads" ? "lead-agent" : "research-agent",
      action.kind === "leads" ? "finding real people" : "checking the live market",
      60,
    );

    const config = await businessConfigFor(agent);
    const result = await runAction(admin, agent.user_id, action, {
      icp: config.icp || config.audience || config.customer || config.businessContext || "",
      website: config.websiteUrl || "",
      company: config.companyName || config.brand || "",
      competitors: config.competitors || "",
    });

    if (result.evidence) system += `\n\n${result.evidence}`;
    system += presentationRules(action, result);
    return chatComplete(apiKey, system, turns, agent.template_id);
  }

  if (latest && wantsResearch(latest)) {
    await markWorking(
      admin,
      agent.user_id,
      agent.template_id,
      isHead ? "pulling in the right specialist" : "checking live sources",
      50,
      agent.id,
    );
    await markWorking(admin, agent.user_id, "research-agent", "checking the live market", 50);

    const research = await Promise.race([
      gatherLiveResearch(admin, agent.user_id, agent.config ?? {}, latest),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 18_000)),
    ]);
    if (research?.used) {
      system +=
        "\n\nLIVE RESEARCH pulled just now. Use these specific facts, not generic memory. Do not paste the research log or announce that you researched it:\n" +
        research.text;
      await markWorking(admin, agent.user_id, "content-agent", "turning the signal into something usable", 40);
    }
  } else if (latest) {
    await markWorking(admin, agent.user_id, agent.template_id, "on it", 20, agent.id);
  }

  return chatComplete(apiKey, system, turns, agent.template_id);
}
