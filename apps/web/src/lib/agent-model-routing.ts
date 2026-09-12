import "server-only";

/**
 * Agent Army v2 model routing.
 *
 * Design goals:
 * - one stable primary model/provider per role (no model roulette every turn)
 * - provider-diverse fallback only when the primary is genuinely unavailable
 * - never move a live tool/chat loop unless the current attempt failed
 * - env overrides for every provider/model, so a renamed free model is a config
 *   change rather than a code deploy
 * - free/low-cost providers first; OpenRouter remains the last compatibility
 *   fallback for existing installs
 *
 * A provider shown as "free" on a dashboard is not trusted just because of the
 * label. The first real completion is the health truth. 401/402/403, 429 and
 * 5xx only bench that candidate for the current request; the next provider is
 * tried without taking the whole army down.
 */

export type ProviderId =
  | "nvidia"
  | "routeway"
  | "zai"
  | "apinex"
  | "nararouter"
  | "tokenharbor"
  | "openrouter";

export interface ModelCandidate {
  provider: ProviderId;
  model: string;
  baseUrl: string;
  apiKey: string;
  /** Small label for traces. Never show this to the founder. */
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
    case "nvidia": {
      const apiKey = clean(process.env.NVIDIA_API_KEY);
      if (!apiKey) return null;
      return {
        id,
        apiKey,
        baseUrl: base(clean(process.env.NVIDIA_BASE_URL) || "https://integrate.api.nvidia.com/v1"),
      };
    }
    case "routeway": {
      const apiKey = clean(process.env.ROUTEWAY_API_KEY);
      if (!apiKey) return null;
      return {
        id,
        apiKey,
        baseUrl: base(clean(process.env.ROUTEWAY_BASE_URL) || "https://api.routeway.ai/v1"),
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
    case "apinex": {
      const apiKey = clean(process.env.APINEX_API_KEY);
      // APINex screenshots expose model ids, but the public base URL has not
      // been stable enough to hard-code safely. Require it explicitly.
      const baseUrl = clean(process.env.APINEX_BASE_URL);
      if (!apiKey || !baseUrl) return null;
      return { id, apiKey, baseUrl: base(baseUrl) };
    }
    case "nararouter": {
      const apiKey = clean(process.env.NARAROUTER_API_KEY);
      const baseUrl = clean(process.env.NARAROUTER_BASE_URL);
      if (!apiKey || !baseUrl) return null;
      return { id, apiKey, baseUrl: base(baseUrl) };
    }
    case "tokenharbor": {
      const apiKey = clean(process.env.TOKENHARBOR_API_KEY);
      const baseUrl = clean(process.env.TOKENHARBOR_BASE_URL);
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
}

/**
 * Pinned primaries. Model ids visible in the user's provider dashboards are
 * used where they are explicit. Every one is env-overridable because free
 * catalogues move quickly.
 */
const PINNED: Record<string, { provider: ProviderId; model: () => string }> = {
  "head-agent": {
    provider: "nvidia",
    model: () => clean(process.env.AGENT_MODEL_HEAD) || "moonshotai/kimi-k3",
  },
  "research-agent": {
    provider: "apinex",
    model: () => clean(process.env.AGENT_MODEL_RESEARCH) || "free/gemini-3.8-flash",
  },
  "analytics-agent": {
    provider: "routeway",
    model: () => clean(process.env.AGENT_MODEL_ANALYTICS) || clean(process.env.ROUTEWAY_DEEPSEEK_MODEL) || "deepseek-v4-flash-free",
  },
  "content-agent": {
    provider: "apinex",
    model: () => clean(process.env.AGENT_MODEL_CONTENT) || "free/gpt-5.6-luna",
  },
  "seo-agent": {
    provider: "zai",
    model: () => clean(process.env.AGENT_MODEL_SEO) || "glm-4.7",
  },
  "landing-agent": {
    provider: "routeway",
    model: () => clean(process.env.AGENT_MODEL_CRO) || clean(process.env.ROUTEWAY_KIMI_MODEL) || "kimi-k2.6-free",
  },
  "lead-agent": {
    provider: "routeway",
    model: () => clean(process.env.AGENT_MODEL_LEADS) || clean(process.env.ROUTEWAY_MINIMAX_MODEL) || "minimax-m2.7-free",
  },
  "outreach-agent": {
    provider: "apinex",
    model: () => clean(process.env.AGENT_MODEL_OUTREACH) || "free/qwen-3.8-max",
  },
};

const FALLBACK_MODELS: Partial<Record<ProviderId, () => string>> = {
  nvidia: () => clean(process.env.NVIDIA_FALLBACK_MODEL) || "moonshotai/kimi-k3",
  zai: () => clean(process.env.ZAI_FALLBACK_MODEL) || "glm-4.7",
  apinex: () => clean(process.env.APINEX_FALLBACK_MODEL) || "free/deepseek-v4.1-flash",
  routeway: () => clean(process.env.ROUTEWAY_FALLBACK_MODEL) || clean(process.env.ROUTEWAY_DEEPSEEK_MODEL) || "deepseek-v4-flash-free",
  nararouter: () => clean(process.env.NARAROUTER_MODEL),
  tokenharbor: () => clean(process.env.TOKENHARBOR_MODEL),
  openrouter: () => clean(process.env.OPENROUTER_ARMY_MODEL) || "deepseek/deepseek-chat-v3-0324:free",
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
 * We intentionally do not race providers. A marketing agent is a long-lived
 * colleague, not a benchmark request. Stable assignment gives it predictable
 * style and makes failures debuggable. Failover happens only after a concrete
 * failure from the pinned provider.
 */
export function routeForAgent(templateId: string, legacyOpenRouterKey?: string | null): ModelCandidate[] {
  const out: ModelCandidate[] = [];
  const seen = new Set<string>();
  const pinned = PINNED[templateId] ?? {
    provider: "openrouter" as ProviderId,
    model: () => clean(process.env.OPENROUTER_ARMY_MODEL) || "deepseek/deepseek-chat-v3-0324:free",
  };

  const add = (providerId: ProviderId, model: string, label: string) => {
    const key = `${providerId}:${model}`;
    if (!model || seen.has(key)) return;
    const candidate = toCandidate(providerId, model, label);
    if (candidate) {
      seen.add(key);
      out.push(candidate);
    }
  };

  add(pinned.provider, pinned.model(), "primary");

  // Provider diversity matters more than trying three models behind the same
  // outage. These are deliberately ordered from independently-hosted providers.
  const fallbackOrder: ProviderId[] = ["nvidia", "zai", "routeway", "apinex", "nararouter", "tokenharbor", "openrouter"];
  for (const providerId of fallbackOrder) {
    if (providerId === pinned.provider) continue;
    const model = FALLBACK_MODELS[providerId]?.() ?? "";
    add(providerId, model, "fallback");
  }

  // Existing founder/house OpenRouter keys still work even if none of the new
  // platform env vars are set. This keeps the migration backwards compatible.
  if (legacyOpenRouterKey && !out.some((c) => c.provider === "openrouter")) {
    out.push({
      provider: "openrouter",
      model: clean(process.env.OPENROUTER_ARMY_MODEL) || "deepseek/deepseek-chat-v3-0324:free",
      baseUrl: base(clean(process.env.OPENROUTER_BASE_URL) || "https://openrouter.ai/api/v1"),
      apiKey: legacyOpenRouterKey,
      routeLabel: "legacy-fallback",
    });
  }

  return out;
}

export function anyArmyModelKey(): string | null {
  const providers: ProviderId[] = ["nvidia", "routeway", "zai", "apinex", "nararouter", "tokenharbor", "openrouter"];
  for (const id of providers) {
    const p = provider(id);
    if (p?.apiKey) return p.apiKey;
  }
  return null;
}

export function assignedRoute(templateId: string): { provider: ProviderId; model: string } {
  const pinned = PINNED[templateId];
  if (!pinned) return { provider: "openrouter", model: clean(process.env.OPENROUTER_ARMY_MODEL) || "deepseek/deepseek-chat-v3-0324:free" };
  return { provider: pinned.provider, model: pinned.model() };
}
