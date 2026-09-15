import { createHash } from "node:crypto";
import "server-only";
import {
  discover,
  inspect,
  runAndWait,
  rowsOf,
  costOf,
  failureOf,
  priceOf,
  MonidError,
  type MonidEndpoint,
} from "./monid";

/**
 * Monid capability routing.
 *
 * Autonomous agents are not allowed to pick an arbitrary expensive endpoint.
 * Each capability has a small result cap, a maximum catalogue unit price, and
 * (where we know the economics) a preferred provider/endpoint shortlist.
 *
 * Multiple Monid keys are reliability backups. A bad/revoked key or a Monid
 * infrastructure error may fall through to the next configured key. Workspace
 * budget blocks, payment/quota responses and rate limits do NOT rotate to a new
 * key: those are spending controls, not availability failures.
 */

export interface CapabilityParams {
  query: string;
  limit?: number;
  extra?: Record<string, unknown>;
}

interface PreferredEndpoint {
  provider: string;
  endpoint: string;
}

interface Capability {
  id: string;
  discoverQuery: string;
  label: string;
  queryAliases: string[];
  limitAliases: string[];
  arrayAliases?: string[];
  /** Never autonomously select a catalogue endpoint above this unit price. */
  maxUnitPrice: number;
  /** Default/max result count for unattended work. */
  defaultLimit: number;
  preferred?: PreferredEndpoint[];
}

export const CAPABILITIES = {
  leads: {
    id: "leads",
    discoverQuery: "b2b people search company employees",
    label: "lead search",
    queryAliases: ["query", "q", "keywords", "searchTerms", "search", "jobTitle", "title"],
    limitAliases: ["limit", "maxItems", "maxResults", "resultsLimit", "count", "perPage"],
    arrayAliases: ["searchTerms", "keywords"],
    maxUnitPrice: 0.02,
    defaultLimit: 5,
    preferred: [
      { provider: "Ploid", endpoint: "/search" },
      { provider: "Clay", endpoint: "/search/query-mode/run" },
    ],
  },
  email: {
    id: "email",
    discoverQuery: "email finder person work email",
    label: "address lookup",
    queryAliases: ["query", "q", "name", "fullName", "full_name", "person", "search", "domain", "linkedinUrl", "linkedin_url"],
    limitAliases: ["limit", "maxItems", "maxResults", "count"],
    maxUnitPrice: 0.03,
    defaultLimit: 1,
    preferred: [
      { provider: "ContactOut", endpoint: "/v1/people/enrich/work-email" },
      { provider: "Hunter", endpoint: "/combined/find" },
    ],
  },
  research: {
    id: "research",
    discoverQuery: "web search news articles",
    label: "market research",
    queryAliases: ["query", "q", "search", "searchTerms", "keywords", "keyword", "prompt"],
    limitAliases: ["limit", "maxItems", "maxResults", "resultsLimit", "num"],
    arrayAliases: ["searchTerms", "keywords"],
    maxUnitPrice: 0.02,
    defaultLimit: 5,
  },
  serp: {
    id: "serp",
    discoverQuery: "google search results serp keywords",
    label: "search results",
    queryAliases: ["query", "q", "keyword", "keywords", "searchTerms", "search", "term"],
    limitAliases: ["limit", "maxItems", "maxResults", "resultsLimit", "num", "count"],
    arrayAliases: ["keywords", "searchTerms"],
    maxUnitPrice: 0.06,
    defaultLimit: 2,
    preferred: [{ provider: "Ahrefs", endpoint: "/serp-overview/serp-overview" }],
  },
  jobs: {
    id: "jobs",
    discoverQuery: "job postings hiring company",
    label: "hiring signals",
    queryAliases: ["query", "q", "keywords", "search", "title", "jobTitle", "company"],
    limitAliases: ["limit", "maxItems", "maxResults", "resultsLimit"],
    arrayAliases: ["keywords"],
    maxUnitPrice: 0.01,
    defaultLimit: 8,
    preferred: [{ provider: "Apify", endpoint: "/harvestapi/linkedin-job-search" }],
  },
  company: {
    id: "company",
    discoverQuery: "company profile enrichment domain",
    label: "company lookup",
    queryAliases: ["domain", "companyDomain", "query", "q", "url", "website", "name"],
    limitAliases: ["limit", "maxItems", "maxResults"],
    maxUnitPrice: 0.02,
    defaultLimit: 1,
    preferred: [
      { provider: "Ploid", endpoint: "/linkedin/company" },
      { provider: "TikHub", endpoint: "/api/v1/linkedin/web_v2/get_company_profile" },
    ],
  },
  social: {
    id: "social",
    discoverQuery: "linkedin social posts search",
    label: "social listening",
    queryAliases: ["searchTerms", "keywords", "query", "q", "search", "hashtags", "text"],
    limitAliases: ["maxItems", "maxResults", "limit", "resultsLimit"],
    arrayAliases: ["searchTerms", "keywords", "hashtags"],
    maxUnitPrice: 0.02,
    defaultLimit: 4,
    preferred: [
      { provider: "Apify", endpoint: "/harvestapi/linkedin-post-search" },
      { provider: "Ploid", endpoint: "/linkedin/posts" },
      { provider: "Ploid", endpoint: "/linkedin/company-posts" },
    ],
  },
  reviews: {
    id: "reviews",
    discoverQuery: "business reviews scraper",
    label: "review monitoring",
    queryAliases: ["query", "q", "search", "searchTerms", "url", "placeUrl"],
    limitAliases: ["maxItems", "maxResults", "limit", "resultsLimit"],
    arrayAliases: ["searchTerms"],
    maxUnitPrice: 0.02,
    defaultLimit: 5,
  },
  page: {
    id: "page",
    discoverQuery: "fetch page clean markdown content extraction",
    label: "page read",
    queryAliases: ["url", "urls", "query", "target", "website"],
    limitAliases: ["limit", "maxItems", "maxResults"],
    arrayAliases: ["urls"],
    maxUnitPrice: 0.002,
    defaultLimit: 1,
    preferred: [
      { provider: "TinyFish", endpoint: "/fetch" },
      { provider: "Context.dev", endpoint: "/web/scrape/markdown" },
      { provider: "Firecrawl", endpoint: "/scrape" },
      { provider: "MrScraper", endpoint: "/scrape/markdown" },
    ],
  },
} satisfies Record<string, Capability>;

export type CapabilityId = keyof typeof CAPABILITIES;

const resolved = new Map<string, { endpoint: MonidEndpoint; at: number }>();
const RESOLVE_TTL_MS = 30 * 60_000;
const badKeys = new Map<string, number>();
const BAD_KEY_TTL_MS = 5 * 60_000;

function keyHash(apiKey: string): string {
  return createHash("sha256").update(apiKey).digest("hex").slice(0, 16);
}

function preferredRank(capability: Capability, endpoint: MonidEndpoint): number {
  const list = capability.preferred ?? [];
  const provider = endpoint.provider.toLowerCase();
  const path = endpoint.endpoint.toLowerCase();
  const index = list.findIndex(
    (candidate) =>
      candidate.provider.toLowerCase() === provider &&
      candidate.endpoint.toLowerCase() === path,
  );
  return index === -1 ? 999 : index;
}

function healthRank(endpoint: MonidEndpoint): number {
  const health = endpoint.metrics?.health ?? "unknown";
  if (health === "healthy") return 0;
  if (health === "stable") return 1;
  if (health === "unknown") return 2;
  return 3;
}

function chooseEndpoint(capability: Capability, found: MonidEndpoint[]): MonidEndpoint | null {
  const candidates = found.filter((endpoint) => {
    const price = priceOf(endpoint);
    return Number.isFinite(price) && price <= capability.maxUnitPrice;
  });

  candidates.sort((a, b) => {
    const preferred = preferredRank(capability, a) - preferredRank(capability, b);
    if (preferred !== 0) return preferred;

    const verified = Number(Boolean(b.verified)) - Number(Boolean(a.verified));
    if (verified !== 0) return verified;

    const health = healthRank(a) - healthRank(b);
    if (health !== 0) return health;

    const price = priceOf(a) - priceOf(b);
    if (price !== 0) return price;

    return (b.score ?? 0) - (a.score ?? 0);
  });

  return candidates[0] ?? null;
}

async function resolveEndpoint(apiKey: string, capability: Capability): Promise<MonidEndpoint | null> {
  const cacheKey = keyHash(apiKey) + ":" + capability.id;
  const cached = resolved.get(cacheKey);
  if (cached && Date.now() - cached.at < RESOLVE_TTL_MS) return cached.endpoint;

  const found = await discover(apiKey, capability.discoverQuery, {
    limit: 12,
    cheapestFirst: false,
  });
  const best = chooseEndpoint(capability, found);
  if (!best) return null;

  if (resolved.size >= 1000) resolved.clear();
  resolved.set(cacheKey, { endpoint: best, at: Date.now() });
  return best;
}

type Slot = "body" | "queryParams" | "pathParams";

function schemaSlots(schema: {
  body?: Record<string, unknown>;
  queryParams?: Record<string, unknown>;
  pathParams?: Record<string, unknown>;
}): Map<string, Slot> {
  const slots = new Map<string, Slot>();
  for (const slot of ["body", "queryParams", "pathParams"] as const) {
    for (const key of Object.keys(schema[slot] ?? {})) slots.set(key, slot);
  }
  return slots;
}

function pickAlias(slots: Map<string, Slot>, aliases: string[]): string | null {
  for (const alias of aliases) if (slots.has(alias)) return alias;
  const lower = new Map([...slots.keys()].map((key) => [key.toLowerCase(), key]));
  for (const alias of aliases) {
    const hit = lower.get(alias.toLowerCase());
    if (hit) return hit;
  }
  return null;
}

export interface CapabilityResult {
  ok: boolean;
  rows: Record<string, unknown>[];
  via: string | null;
  cost: number;
  reason: string | null;
  /** 1-based configured key slot; never contains any part of the secret. */
  keySlot: number | null;
}

const EMPTY = (reason: string): CapabilityResult => ({
  ok: false,
  rows: [],
  via: null,
  cost: 0,
  reason,
  keySlot: null,
});

function shouldTryBackup(error: unknown): boolean {
  if (!(error instanceof MonidError)) return true;
  if (error.status == null) return true; // network/timeout before Monid answered
  if (error.status === 401 || error.status === 408) return true;
  if (error.status >= 500) return true;

  // Deliberately false for 402/403/429 and every other spending/rate control.
  return false;
}

function configuredKeys(input: string | readonly string[]): string[] {
  const keys = (Array.isArray(input) ? input : [input])
    .map((key) => key.trim())
    .filter(Boolean);
  return [...new Set(keys)];
}

async function runOnKey(
  apiKey: string,
  keySlot: number,
  capability: Capability,
  params: CapabilityParams,
  budgetMs: number,
): Promise<CapabilityResult> {
  const endpoint = await resolveEndpoint(apiKey, capability);
  if (!endpoint) {
    return EMPTY(
      `No priced ${capability.label} endpoint is inside the autonomous cost cap ($${capability.maxUnitPrice.toFixed(3)} unit price).`,
    );
  }

  const via = `${endpoint.provider}${endpoint.endpoint}`;
  const detail = await inspect(apiKey, endpoint.provider, endpoint.endpoint);
  const schema = detail.input ?? {};
  const slots = schemaSlots(schema);
  const queryField = pickAlias(slots, capability.queryAliases);

  if (!queryField) {
    return {
      ...EMPTY(
        `Monid's ${via} does not expose a search/input field this capability recognises (${[...slots.keys()].slice(0, 8).join(", ") || "no fields"}).`,
      ),
      via,
      keySlot,
    };
  }

  const input: {
    body: Record<string, unknown>;
    queryParams: Record<string, unknown>;
    pathParams: Record<string, unknown>;
  } = { body: {}, queryParams: {}, pathParams: {} };

  const place = (field: string, value: unknown) => {
    const slot = slots.get(field) ?? "body";
    input[slot][field] = value;
  };

  const wantsArray = capability.arrayAliases?.some(
    (alias) => alias.toLowerCase() === queryField.toLowerCase(),
  );
  place(queryField, wantsArray ? [params.query] : params.query);

  const limitField = pickAlias(slots, capability.limitAliases);
  const requested = params.limit ?? capability.defaultLimit;
  const cappedLimit = Math.max(1, Math.min(requested, capability.defaultLimit));
  if (limitField) place(limitField, cappedLimit);

  for (const [key, value] of Object.entries(params.extra ?? {})) {
    if (slots.has(key)) place(key, value);
  }

  const run = await runAndWait(apiKey, endpoint.provider, endpoint.endpoint, input, budgetMs);
  const failure = failureOf(run);
  return {
    ok: !failure,
    rows: rowsOf(run),
    via,
    cost: costOf(run),
    reason: failure,
    keySlot,
  };
}

/**
 * Execute a capability with strict cost policy and reliability-only key failover.
 *
 * Backup keys are tried only when the previous key is revoked or Monid itself
 * is unavailable. A workspace budget/quota/rate-limit response is returned to
 * the caller and stops immediately rather than hopping keys.
 */
export async function runCapability(
  apiKeys: string | readonly string[],
  capabilityId: CapabilityId,
  params: CapabilityParams,
  budgetMs = 60_000,
): Promise<CapabilityResult> {
  const capability = CAPABILITIES[capabilityId];
  if (!params.query.trim()) return EMPTY("Nothing to search for.");

  const keys = configuredKeys(apiKeys);
  if (!keys.length) return EMPTY("Monid is not configured.");

  let lastError: unknown = null;
  for (let index = 0; index < keys.length; index += 1) {
    const apiKey = keys[index];
    const hash = keyHash(apiKey);
    const coolingUntil = badKeys.get(hash) ?? 0;
    if (coolingUntil > Date.now()) continue;

    try {
      return await runOnKey(apiKey, index + 1, capability, params, budgetMs);
    } catch (error) {
      lastError = error;
      if (!shouldTryBackup(error)) {
        return {
          ...EMPTY(error instanceof Error ? error.message : "The Monid run failed."),
          keySlot: index + 1,
        };
      }
      badKeys.set(hash, Date.now() + BAD_KEY_TTL_MS);
    }
  }

  return EMPTY(
    lastError instanceof Error
      ? `Monid backup pool exhausted after an availability failure: ${lastError.message}`
      : "Monid backup pool is temporarily unavailable.",
  );
}

export function rowsBlock(rows: Record<string, unknown>[], max = 12): string {
  return rows
    .slice(0, max)
    .map((row, index) => {
      const fields = Object.entries(row)
        .filter(([, value]) => value != null && value !== "" && typeof value !== "object")
        .slice(0, 10)
        .map(([key, value]) => `  ${key}: ${String(value).slice(0, 160)}`)
        .join("\n");
      return `${index + 1}.\n${fields}`;
    })
    .join("\n\n");
}
