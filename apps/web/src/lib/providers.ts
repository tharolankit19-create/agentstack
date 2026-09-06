import "server-only";

/**
 * Seven model providers, tried in order until one answers.
 *
 * One key was never going to hold. The army is twenty-five agents running on
 * crons every few minutes across every founder on the platform, and every free
 * tier in existence is rate-limited — so a single provider means the whole
 * platform goes quiet the moment that provider says "slow down", and it says it
 * daily. Chaining them turns a hard stop into a slower lane: the request moves
 * to the next provider and the agents keep working.
 *
 * **Every base URL below was probed against the live API before it was written
 * here, not inferred from a docs page.** That is a direct lesson from the Monid
 * integration, where paths read off a CLI bundle silently did nothing for
 * weeks. A 401 from a real endpoint and a 404 from an invented one look
 * identical in a log; the only way to tell them apart is to ask.
 *
 * Order is capability first, then reliability. The founder never learns which
 * one answered, and should not have to.
 *
 *   1. gemini        Google's own free tier. The most capable free model
 *                    generally available, straight from the provider with no
 *                    router in between.
 *   2. requesty      706 models, a dozen at zero cost including Nemotron 3
 *                    Ultra at 550B — the largest free weights on the list.
 *   3. orca          DeepSeek V4 Flash free: 284B MoE, 1M context.
 *   4. alibaba       Qwen's flagship on DashScope's free quota.
 *   5. bazaarlink    `auto:free` picks a free model for us, so this lane keeps
 *                    working when a specific model id is retired.
 *   6. eden          Gemma and Mistral on a free tier.
 *   7. openrouter    The original. Last because its free tier is the most
 *                    heavily contended, not because it is the worst.
 *
 * All of it is env-overridable — order, models, base URLs — so a provider that
 * changes its terms is a config change and not a deploy.
 */

export type Dialect = "openai";

export interface Provider {
  id: string;
  label: string;
  /**
   * Env vars holding the key, first non-empty wins.
   *
   * Several names per provider because the operator sets whichever one they
   * read in a docs page, and an integration that works only for the spelling
   * we guessed is an integration that silently does not work.
   */
  envKeys: string[];
  /** OpenAI-compatible root. `/chat/completions` is appended. Probed, not guessed. */
  baseUrl: string;
  /** Free models, best first. Env var overrides the whole list. */
  models: string[];
  /** Which env var replaces `models`, comma-separated. */
  modelsEnv: string;
  /** Which env var replaces `baseUrl`. */
  baseUrlEnv: string;
  dialect: Dialect;
  headers?: Record<string, string>;
}

const PROVIDERS: Provider[] = [
  {
    id: "gemini",
    label: "Google Gemini",
    envKeys: ["GEMINI_API_KEY", "GOOGLE_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY"],
    // Google's OpenAI-compatibility shim. Verified: returns a structured
    // "pass a valid API key" rather than a 404, so the route is real.
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    baseUrlEnv: "GEMINI_BASE_URL",
    modelsEnv: "GEMINI_MODELS",
    models: [
      "gemini-2.5-flash",
      "gemini-2.5-flash-lite",
      "gemini-2.0-flash",
    ],
    dialect: "openai",
  },
  {
    id: "requesty",
    label: "Requesty",
    envKeys: ["REQUESTY_API_KEY"],
    // Verified: /v1/models answers 200 without a key and lists 706 models.
    baseUrl: "https://router.requesty.ai/v1",
    baseUrlEnv: "REQUESTY_BASE_URL",
    modelsEnv: "REQUESTY_MODELS",
    // Read off that live list, filtered to zero input and output price.
    models: [
      "nvidia/nemotron-3-ultra-550b-a55b",
      "nvidia/nemotron-3-super-120b-a12b",
      "google/gemma-4-31b-it",
      "nvidia/nemotron-3-nano-30b-a3b",
    ],
    dialect: "openai",
  },
  {
    id: "orca",
    label: "OrcaRouter",
    envKeys: ["ORCA_API_KEY", "ORCAROUTER_API_KEY"],
    // Verified: 401 "Invalid API key" with a request id — a real endpoint.
    // Note the api. subdomain; orcarouter.ai/api/v1 is a 301 to the console.
    baseUrl: "https://api.orcarouter.ai/v1",
    baseUrlEnv: "ORCA_BASE_URL",
    modelsEnv: "ORCA_MODELS",
    // The four free ids on its public catalogue. `orcarouter/free` last: it is
    // a meta-model that picks for us, which is the right fallback but a worse
    // default than naming the one we want.
    models: [
      "deepseek/deepseek-v4-flash-free",
      "qwen/qwen3.8-27b-free",
      "tencent/hy3-free",
      "orcarouter/free",
    ],
    dialect: "openai",
  },
  {
    id: "alibaba",
    label: "Alibaba Cloud (DashScope)",
    envKeys: ["ALIBABACLOUD_API_KEY", "DASHSCOPE_API_KEY", "ALIBABA_API_KEY"],
    // Verified: 401 naming the Alibaba Cloud docs.
    baseUrl: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
    baseUrlEnv: "ALIBABACLOUD_BASE_URL",
    modelsEnv: "ALIBABACLOUD_MODELS",
    models: ["qwen-plus", "qwen-turbo", "qwen-flash"],
    dialect: "openai",
  },
  {
    id: "bazaarlink",
    label: "BazaarLink",
    envKeys: ["BAZAARAI_API_KEY", "BAZAARLINK_API_KEY"],
    // Verified: /v1/models answers 200 and lists 170 models.
    baseUrl: "https://api.bazaarlink.ai/v1",
    baseUrlEnv: "BAZAARAI_BASE_URL",
    modelsEnv: "BAZAARAI_MODELS",
    // `auto:free` is theirs, and it is the durable choice — it keeps working
    // when a specific free model is retired, which on free tiers is often.
    models: ["auto:free", "qwen/qwen3.7-flash:free"],
    dialect: "openai",
  },
  {
    id: "eden",
    label: "Eden AI",
    envKeys: ["EDEN_API_KEY", "EDENAI_API_KEY"],
    // Verified: 401 "Invalid token" on the LLM sub-API, which is the
    // OpenAI-compatible one. The v2 root is not.
    baseUrl: "https://api.edenai.run/v2/llm",
    baseUrlEnv: "EDEN_BASE_URL",
    modelsEnv: "EDEN_MODELS",
    models: [
      "gemma-4-31b-it",
      "gemma-4-26b-a4b-it",
      "ternary-bonsai-27b",
      "mistral-7b-instruct-v0.2-lora",
    ],
    dialect: "openai",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    envKeys: [
      "OPENROUTER_API_KEY",
      "PLATFORM_OPENROUTER_KEY",
      "PLATFORM_MODEL_KEY",
      "DEMO_OPENAI_API_KEY",
    ],
    baseUrl: "https://openrouter.ai/api/v1",
    baseUrlEnv: "OPENROUTER_BASE_URL",
    modelsEnv: "CHAT_MODELS",
    models: [
      "deepseek/deepseek-chat-v3-0324:free",
      "meta-llama/llama-3.3-70b-instruct:free",
      "qwen/qwen-2.5-72b-instruct:free",
      "mistralai/mistral-small-3.2-24b-instruct:free",
      "google/gemma-2-9b-it:free",
    ],
    dialect: "openai",
    headers: {
      // OpenRouter asks callers to identify themselves.
      "HTTP-Referer": "https://marketingagentsarmy.com",
      "X-Title": "Marketing Agents Army",
    },
  },
];

/** One configured provider, ready to call. */
export interface Lane {
  provider: Provider;
  apiKey: string;
  baseUrl: string;
  models: string[];
}

function envList(name: string): string[] | null {
  const raw = process.env[name]?.trim();
  if (!raw) return null;
  const list = raw.split(",").map((m) => m.trim()).filter(Boolean);
  return list.length ? list : null;
}

/**
 * Every provider that has a key, in the order they should be tried.
 *
 * `MODEL_PROVIDER_ORDER` reorders or narrows the chain without a deploy — the
 * one control worth having when a provider starts misbehaving at 3am. A name in
 * that list with no key is skipped rather than treated as an error, so the
 * operator can write the full order once and add keys over time.
 */
export function lanes(): Lane[] {
  const order = envList("MODEL_PROVIDER_ORDER");

  const chosen = order
    ? order
        .map((id) => PROVIDERS.find((p) => p.id === id.toLowerCase()))
        .filter((p): p is Provider => Boolean(p))
    : PROVIDERS;

  const out: Lane[] = [];

  for (const provider of chosen) {
    const apiKey = provider.envKeys
      .map((name) => process.env[name]?.trim())
      .find((value) => Boolean(value));
    if (!apiKey) continue;

    out.push({
      provider,
      apiKey,
      baseUrl: (process.env[provider.baseUrlEnv]?.trim() || provider.baseUrl).replace(/\/+$/, ""),
      models: envList(provider.modelsEnv) ?? provider.models,
    });
  }

  return out;
}

/** Which providers are configured, for diagnostics and the status card. */
export function configuredProviderIds(): string[] {
  return lanes().map((lane) => lane.provider.id);
}

/** Every provider we know how to call, configured or not. */
export function allProviders(): Provider[] {
  return PROVIDERS;
}

/**
 * The exact sequence of (provider, model) attempts for one request.
 *
 * Extracted from `chatComplete` so it can be tested without a network, a
 * database, or a Next runtime — the ordering *is* the feature here, and a
 * feature that can only be verified by watching production is not verified.
 *
 * `callerKey` leads, because a founder or admin who supplied their own key
 * expects their key used first. It is matched to the lane it belongs to; a key
 * from nowhere we recognise is tried on OpenRouter, which is where keys of
 * unknown origin came from historically. Either way the rest of the chain
 * follows it rather than replacing it.
 */
export function attemptOrder(
  chain: Lane[],
  callerKey?: string | null,
): { lane: Lane; model: string }[] {
  const attempts: { lane: Lane; model: string }[] = [];

  let leading: Lane | null = null;
  if (callerKey) {
    const owner = chain.find((lane) => lane.apiKey === callerKey);
    if (owner) {
      leading = owner;
    } else {
      const openrouter = chain.find((lane) => lane.provider.id === "openrouter");
      if (openrouter) leading = { ...openrouter, apiKey: callerKey };
    }
  }

  if (leading) {
    for (const model of leading.models) attempts.push({ lane: leading, model });
  }

  for (const lane of chain) {
    if (leading && lane.provider.id === leading.provider.id) continue;
    for (const model of lane.models) attempts.push({ lane, model });
  }

  return attempts;
}

/**
 * What a provider's HTTP status means for the rest of the request.
 *
 *   "retire"  this provider is out for this request — its remaining models
 *             would all fail the same way, so skip them
 *   "next"    this attempt failed, try the next model or provider
 *
 * The distinction is the whole failover policy, so it lives here as one
 * readable function rather than as three status codes buried in a loop.
 *
 * 401/402/403 retire a provider: a rejected key, an unpaid balance and a
 * forbidden account are all properties of the account, not of the model, and
 * trying four more of its models is four more round trips to the same refusal.
 *
 * 429 does **not** retire it. A rate limit is per-model on most of these
 * providers, so the next model on the same provider is often available — and
 * retiring on 429 would throw away the provider we most want during exactly the
 * traffic spike this chain exists for.
 */
export function classify(status: number): "retire" | "next" {
  return status === 401 || status === 402 || status === 403 ? "retire" : "next";
}
