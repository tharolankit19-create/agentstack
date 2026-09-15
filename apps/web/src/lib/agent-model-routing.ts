import "server-only";

/**
 * Provider-diverse agent routing.
 *
 * One agent keeps a stable primary for personality/quality, but a concrete
 * provider failure falls through to independent providers. OpenRouter is not a
 * single point of failure anymore. Unknown providers can be added through
 * MODEL_PROVIDER_1..8 without another code change.
 */

export type ProviderId =
  | "airouter"
  | "aicredits"
  | "orca"
  | "zai"
  | "gemini"
  | "tokenrouter"
  | "alibaba"
  | "airforce"
  | "eden"
  | "openrouter"
  | "requesty"
  | "custom1"
  | "custom2"
  | "custom3"
  | "custom4"
  | "custom5"
  | "custom6"
  | "custom7"
  | "custom8";

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

function customIndex(id: ProviderId): number | null {
  const match = /^custom([1-8])$/.exec(id);
  return match ? Number(match[1]) : null;
}

function provider(id: ProviderId): ProviderConfig | null {
  const custom = customIndex(id);
  if (custom) {
    const apiKey = clean(process.env[`MODEL_PROVIDER_${custom}_API_KEY`]);
    const baseUrl = clean(process.env[`MODEL_PROVIDER_${custom}_BASE_URL`]);
    if (!apiKey || !baseUrl) return null;
    return { id, apiKey, baseUrl: base(baseUrl) };
  }

  switch (id) {
    case "airouter": {
      const apiKey = clean(process.env.AIROUTER_API_KEY);
      if (!apiKey) return null;
      return { id, apiKey, baseUrl: base(clean(process.env.AIROUTER_BASE_URL) || "https://api.airouter.in/v1") };
    }
    case "aicredits": {
      const apiKey = clean(process.env.AICREDITS_API_KEY);
      if (!apiKey) return null;
      return { id, apiKey, baseUrl: base(clean(process.env.AICREDITS_BASE_URL) || "https://aicredits.in/v1") };
    }
    case "orca": {
      const apiKey = clean(process.env.ORCA_API_KEY);
      if (!apiKey) return null;
      return { id, apiKey, baseUrl: base(clean(process.env.ORCA_BASE_URL) || "https://api.orcarouter.ai/v1") };
    }
    case "zai": {
      const apiKey = clean(process.env.ZAI_API_KEY);
      if (!apiKey) return null;
      return { id, apiKey, baseUrl: base(clean(process.env.ZAI_BASE_URL) || "https://api.z.ai/api/paas/v4") };
    }
    case "gemini": {
      const apiKey = clean(process.env.GEMINI_API_KEY);
      if (!apiKey) return null;
      return {
        id,
        apiKey,
        baseUrl: base(
          clean(process.env.GEMINI_OPENAI_BASE_URL) ||
            "https://generativelanguage.googleapis.com/v1beta/openai",
        ),
      };
    }
    case "tokenrouter": {
      const apiKey = clean(process.env.TOKENROUTER_API_KEY);
      const baseUrl = clean(process.env.TOKENROUTER_BASE_URL);
      if (!apiKey || !baseUrl) return null;
      return { id, apiKey, baseUrl: base(baseUrl) };
    }
    case "alibaba": {
      const apiKey = clean(process.env.ALIBABA_API_KEY) || clean(process.env.DASHSCOPE_API_KEY);
      const baseUrl = clean(process.env.ALIBABA_BASE_URL) || clean(process.env.DASHSCOPE_BASE_URL);
      if (!apiKey || !baseUrl) return null;
      return { id, apiKey, baseUrl: base(baseUrl) };
    }
    case "airforce": {
      const apiKey = clean(process.env.AIRFORCE_API_KEY);
      const baseUrl = clean(process.env.AIRFORCE_BASE_URL);
      if (!apiKey || !baseUrl) return null;
      return { id, apiKey, baseUrl: base(baseUrl) };
    }
    case "eden": {
      const apiKey = clean(process.env.EDEN_API_KEY);
      const baseUrl = clean(process.env.EDEN_BASE_URL);
      if (!apiKey || !baseUrl) return null;
      return { id, apiKey, baseUrl: base(baseUrl) };
    }
    case "requesty": {
      const apiKey = clean(process.env.REQUESTY_API_KEY);
      const baseUrl = clean(process.env.REQUESTY_BASE_URL);
      if (!apiKey || !baseUrl) return null;
      return { id, apiKey, baseUrl: base(baseUrl) };
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
  return null;
}

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

const GEMINI_MODEL = () =>
  clean(process.env.GEMINI_AGENT_MODEL) ||
  clean(process.env.GEMINI_MODEL) ||
  "gemini-2.0-flash";

const OPENROUTER_TOP_MODEL = () =>
  clean(process.env.OPENROUTER_ARMY_MODEL) ||
  clean(process.env.OPENROUTER_TOP_FREE_MODEL) ||
  "deepseek/deepseek-r1-0528:free";

const OPENROUTER_FAST_MODEL = () =>
  clean(process.env.OPENROUTER_FAST_MODEL) ||
  clean(process.env.OPENROUTER_ARMY_MODEL) ||
  "deepseek/deepseek-chat-v3-0324:free";

const PINNED: Record<string, { provider: ProviderId; model: () => string }> = {
  "head-agent": { provider: "airouter", model: HEAD_PRIMARY },
  "research-agent": { provider: "aicredits", model: AICREDITS_HARD_MODEL },
  "analytics-agent": { provider: "zai", model: ZAI_HARD_MODEL },
  "content-agent": { provider: "gemini", model: GEMINI_MODEL },
  "seo-agent": { provider: "orca", model: ORCA_HARD_MODEL },
  "landing-agent": { provider: "gemini", model: GEMINI_MODEL },
  "lead-agent": { provider: "zai", model: ZAI_HARD_MODEL },
  "outreach-agent": { provider: "gemini", model: GEMINI_MODEL },
};

function modelFor(id: ProviderId): string {
  const custom = customIndex(id);
  if (custom) return clean(process.env[`MODEL_PROVIDER_${custom}_MODEL`]);

  switch (id) {
    case "airouter":
      return clean(process.env.AIROUTER_FALLBACK_MODEL) || "google/gemini-3.6-flash";
    case "aicredits":
      return AICREDITS_HARD_MODEL();
    case "orca":
      return ORCA_HARD_MODEL();
    case "zai":
      return ZAI_HARD_MODEL();
    case "gemini":
      return GEMINI_MODEL();
    case "tokenrouter":
      return clean(process.env.TOKENROUTER_MODEL);
    case "alibaba":
      return clean(process.env.ALIBABA_MODEL) || clean(process.env.DASHSCOPE_MODEL);
    case "airforce":
      return clean(process.env.AIRFORCE_MODEL);
    case "eden":
      return clean(process.env.EDEN_MODEL);
    case "requesty":
      return clean(process.env.REQUESTY_MODEL);
    case "openrouter":
      return OPENROUTER_TOP_MODEL();
  }
  return "";
}

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

const STANDARD_FALLBACK_ORDER: ProviderId[] = [
  "gemini",
  "orca",
  "zai",
  "airouter",
  "aicredits",
  "tokenrouter",
  "alibaba",
  "airforce",
  "eden",
  "openrouter",
  "custom1",
  "custom2",
  "custom3",
  "custom4",
  "custom5",
  "custom6",
  "custom7",
  "custom8",
  // Requesty stays last by design.
  "requesty",
];

export function routeForAgent(templateId: string, legacyOpenRouterKey?: string | null): ModelCandidate[] {
  const out: ModelCandidate[] = [];
  const seen = new Set<string>();

  const pinned = PINNED[templateId] ?? {
    provider: "gemini" as ProviderId,
    model: GEMINI_MODEL,
  };

  const add = (providerId: ProviderId, model: string, label: string) => {
    const dedupe = `${providerId}:${model}`;
    if (!model || seen.has(dedupe)) return;
    const candidate = toCandidate(providerId, model, label);
    if (!candidate) return;
    seen.add(dedupe);
    out.push(candidate);
  };

  add(pinned.provider, pinned.model(), "primary");

  for (const providerId of STANDARD_FALLBACK_ORDER) {
    if (providerId === pinned.provider) continue;
    add(providerId, modelFor(providerId), "fallback");
  }

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
  for (const id of STANDARD_FALLBACK_ORDER) {
    const p = provider(id);
    if (p?.apiKey) return p.apiKey;
  }
  const pinned = provider("airouter");
  return pinned?.apiKey ?? null;
}

export function assignedRoute(templateId: string): { provider: ProviderId; model: string } {
  const pinned = PINNED[templateId];
  if (!pinned) return { provider: "gemini", model: GEMINI_MODEL() };
  return { provider: pinned.provider, model: pinned.model() };
}
