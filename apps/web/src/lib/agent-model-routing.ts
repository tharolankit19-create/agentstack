import "server-only";

/**
 * Agent Army model routing.
 *
 * The founder asked for a deliberately small provider mesh: OrcaRouter,
 * OpenRouter, Z.ai, AIRouter and AiCredits.  No Routeway/APINex/NaraRouter/
 * TokenHarbor/NVIDIA dependency lives in the default path anymore.
 *
 * Principles:
 * - each role has one stable primary model for consistent behaviour;
 * - a concrete failure moves to the next independent provider immediately;
 * - health is proven by real inference, never by a dashboard balance/free badge;
 * - the same provider/model pair appears only once in a request;
 * - every model id is env-overridable because free catalogues change quickly.
 */

export type ProviderId =
  | "airouter"
  | "aicredits"
  | "orca"
  | "zai"
  | "openrouter";

export interface ModelCandidate {
  provider: ProviderId;
  model: string;
  baseUrl: string;
  apiKey: string;
  routeLabel: string;
}

interface ProviderConfig {
  id: ProviderId;
  baseUrl: string;
  apiKey: string;
}

const clean = (value: string | undefined): string => value?.trim() ?? "";
const base = (value: string): string => value.replace(/\/+$/, "");

function provider(id: ProviderId): ProviderConfig | null {
  switch (id) {
    case "airouter": {
      const apiKey = clean(process.env.AIROUTER_API_KEY);
      if (!apiKey) return null;
      return {
        id,
        apiKey,
        // Grounded in the founder's AIRouter dashboard/code sample.
        baseUrl: base(clean(process.env.AIROUTER_BASE_URL) || "https://api.airouter.in/v1"),
      };
    }
    case "aicredits": {
      const apiKey = clean(process.env.AICREDITS_API_KEY);
      if (!apiKey) return null;
      return {
        id,
        apiKey,
        // Grounded in the founder's AiCredits dashboard.
        baseUrl: base(clean(process.env.AICREDITS_BASE_URL) || "https://aicredits.in/v1"),
      };
    }
    case "orca": {
      const apiKey = clean(process.env.ORCA_API_KEY);
      if (!apiKey) return null;
      return {
        id,
        apiKey,
        // Keep override support in case Orca changes its gateway hostname.
        baseUrl: base(clean(process.env.ORCA_BASE_URL) || "https://api.orcarouter.ai/v1"),
      };
    }
    case "zai": {
      const apiKey = clean(process.env.ZAI_API_KEY);
      if (!apiKey) return null;
      return {
        id,
        apiKey,
        baseUrl: base(clean(process.env.ZAI_BASE_URL) || "https://api.z.ai/api/paas/v4"),
      };
    }
    case "openrouter": {
      const apiKey =
        clean(process.env.OPENROUTER_API_KEY) ||
        clean(process.env.PLATFORM_OPENROUTER_KEY) ||
        clean(process.env.PLATFORM_MODEL_KEY);
      if (!apiKey) return null;
      return {
        id,
        apiKey,
        baseUrl: base(clean(process.env.OPENROUTER_BASE_URL) || "https://openrouter.ai/api/v1"),
      };
    }
  }
}

/**
 * Seamus gets the two new high-quality free routes first:
 * AIRouter Gemini 3.7 Flash, then AiCredits DeepSeek V4.1 Flash.
 * The model ids below are visible in the founder's screenshots.
 */
const HEAD_PRIMARY = () =>
  clean(process.env.AGENT_MODEL_HEAD) ||
  clean(process.env.AIROUTER_HEAD_MODEL) ||
  "google/gemini-3.7-flash";

const AICREDITS_HARD_MODEL = () =>
  clean(process.env.AICREDITS_HARD_MODEL) || "deepseek/deepseek-v4.1-flash";

const ORCA_HARD_MODEL = () =>
  clean(process.env.ORCA_HARD_MODEL) || "deepseek/deepseek-v4-flash-free";

const ZAI_HARD_MODEL = () =>
  clean(process.env.ZAI_HARD_MODEL) || "glm-4.7";

const OPENROUTER_TOP_MODEL = () =>
  clean(process.env.OPENROUTER_ARMY_MODEL) ||
  clean(process.env.OPENROUTER_TOP_FREE_MODEL) ||
  "deepseek/deepseek-r1-0528:free";

const OPENROUTER_FAST_MODEL = () =>
  clean(process.env.OPENROUTER_FAST_MODEL) ||
  clean(process.env.OPENROUTER_ARMY_MODEL) ||
  "deepseek/deepseek-chat-v3-0324:free";

/** Stable per-role primaries. */
const PINNED: Record<string, { provider: ProviderId; model: () => string }> = {
  "head-agent": { provider: "airouter", model: HEAD_PRIMARY },
  "research-agent": { provider: "aicredits", model: AICREDITS_HARD_MODEL },
  "analytics-agent": { provider: "zai", model: ZAI_HARD_MODEL },
  "content-agent": { provider: "openrouter", model: OPENROUTER_FAST_MODEL },
  "seo-agent": { provider: "orca", model: ORCA_HARD_MODEL },
  "landing-agent": { provider: "openrouter", model: OPENROUTER_TOP_MODEL },
  "lead-agent": { provider: "zai", model: ZAI_HARD_MODEL },
  "outreach-agent": { provider: "openrouter", model: OPENROUTER_FAST_MODEL },
};

const FALLBACK_MODELS: Record<ProviderId, () => string> = {
  airouter: () => clean(process.env.AIROUTER_FALLBACK_MODEL) || "google/gemini-3.6-flash",
  aicredits: AICREDITS_HARD_MODEL,
  orca: ORCA_HARD_MODEL,
  zai: ZAI_HARD_MODEL,
  openrouter: OPENROUTER_TOP_MODEL,
};

function toCandidate(providerId: ProviderId, model: string, label: string): ModelCandidate | null {
  const p = provider(providerId);
  if (!p || !model) return null;
  return {
    provider: providerId,
    model,
    baseUrl: p.baseUrl,
    apiKey: p.apiKey,
    routeLabel: label,
  };
}

/**
 * Stable primary + provider-diverse failover.
 *
 * Seamus is special: both new providers are intentionally first because the
 * founder wants the strongest free models on planning/reasoning. If either
 * fails, Orca -> Z.ai -> OpenRouter keeps the conversation alive.
 * Specialists keep a pinned primary, then walk the same independent mesh.
 */
export function routeForAgent(templateId: string, legacyOpenRouterKey?: string | null): ModelCandidate[] {
  const out: ModelCandidate[] = [];
  const seen = new Set<string>();

  const pinned = PINNED[templateId] ?? {
    provider: "openrouter" as ProviderId,
    model: OPENROUTER_FAST_MODEL,
  };

  const add = (providerId: ProviderId, model: string, label: string) => {
    const dedupe = `${providerId}:${model}`;
    if (!model || seen.has(dedupe)) return;
    const candidate = toCandidate(providerId, model, label);
    if (!candidate) return;
    seen.add(dedupe);
    out.push(candidate);
  };

  if (templateId === "head-agent") {
    add("airouter", HEAD_PRIMARY(), "primary");
    add("aicredits", AICREDITS_HARD_MODEL(), "head-fallback");
    add("orca", ORCA_HARD_MODEL(), "head-fallback");
    add("zai", ZAI_HARD_MODEL(), "head-fallback");
    add("openrouter", OPENROUTER_TOP_MODEL(), "head-fallback");
  } else {
    add(pinned.provider, pinned.model(), "primary");
    const order: ProviderId[] = ["orca", "zai", "openrouter", "airouter", "aicredits"];
    for (const providerId of order) {
      if (providerId === pinned.provider) continue;
      add(providerId, FALLBACK_MODELS[providerId](), "fallback");
    }
  }

  // Backwards compatibility: an existing founder/house OpenRouter key can keep
  // the army alive even if OPENROUTER_API_KEY has not been copied to Vercel yet.
  if (legacyOpenRouterKey && !out.some((candidate) => candidate.provider === "openrouter")) {
    out.push({
      provider: "openrouter",
      model: OPENROUTER_TOP_MODEL(),
      baseUrl: base(clean(process.env.OPENROUTER_BASE_URL) || "https://openrouter.ai/api/v1"),
      apiKey: legacyOpenRouterKey,
      routeLabel: "legacy-fallback",
    });
  }

  return out;
}

export function anyArmyModelKey(): string | null {
  const providers: ProviderId[] = ["airouter", "aicredits", "orca", "zai", "openrouter"];
  for (const id of providers) {
    const p = provider(id);
    if (p?.apiKey) return p.apiKey;
  }
  return null;
}

export function assignedRoute(templateId: string): { provider: ProviderId; model: string } {
  const pinned = PINNED[templateId];
  if (!pinned) return { provider: "openrouter", model: OPENROUTER_FAST_MODEL() };
  return { provider: pinned.provider, model: pinned.model() };
}
