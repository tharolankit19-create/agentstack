import "server-only";
import {
  discover,
  inspect,
  runAndWait,
  rowsOf,
  costOf,
  failureOf,
  type MonidEndpoint,
} from "./monid";

/**
 * The jobs the army asks Monid for, and how to ask.
 *
 * Monid's own guidance is discover → inspect → run, with a human reading the
 * schema in between. A cron has no human, so the reading has to be encoded. Two
 * things make that tractable rather than a guessing game:
 *
 * A capability names the *need*, not the endpoint. "People at companies matching
 * a description" is stable; whichever provider serves it best this month is not,
 * and the catalogue grows continuously. Discovery picks the endpoint at run
 * time, so the army follows the catalogue instead of pinning to one vendor.
 *
 * Parameters are mapped onto whatever the chosen endpoint actually calls them.
 * Every provider names the same idea differently — `query`, `searchTerms`,
 * `keywords`, `q` — so each capability carries an alias list per parameter, and
 * the real schema from `inspect` decides which alias wins. When the essential
 * parameter cannot be placed, the run is abandoned *before* it starts: a run
 * fired at a schema we did not understand spends the founder's balance to
 * produce something nobody can read.
 */

/** The normalised parameters a caller passes, before they are renamed. */
export interface CapabilityParams {
  /** The one search term. Singular on purpose — see the cost note below. */
  query: string;
  /** How many results. Kept small; most endpoints bill per result. */
  limit?: number;
  /** Anything else the caller knows, tried against the schema by exact name. */
  extra?: Record<string, unknown>;
}

interface Capability {
  id: string;
  /** A short noun phrase. Monid's matcher does best with these. */
  discoverQuery: string;
  /** What the founder is told this does, when it is reported or billed. */
  label: string;
  /** Field names providers use for the search term, best first. */
  queryAliases: string[];
  /** Field names providers use for the result cap, best first. */
  limitAliases: string[];
  /** Aliases whose value must be an array rather than a bare string. */
  arrayAliases?: string[];
}

export const CAPABILITIES: Record<string, Capability> = {
  leads: {
    id: "leads",
    discoverQuery: "b2b people search company employees",
    label: "lead search",
    queryAliases: ["query", "q", "keywords", "searchTerms", "search", "jobTitle", "title"],
    limitAliases: ["limit", "maxItems", "maxResults", "resultsLimit", "count", "perPage"],
    arrayAliases: ["searchTerms", "keywords"],
  },
  email: {
    id: "email",
    discoverQuery: "email finder person work email",
    label: "address lookup",
    queryAliases: ["query", "q", "name", "fullName", "full_name", "person", "search", "domain"],
    limitAliases: ["limit", "maxItems", "maxResults", "count"],
  },
  research: {
    id: "research",
    discoverQuery: "web search news articles",
    label: "market research",
    queryAliases: ["query", "q", "search", "searchTerms", "keywords", "keyword"],
    limitAliases: ["limit", "maxItems", "maxResults", "resultsLimit", "num"],
    arrayAliases: ["searchTerms", "keywords"],
  },
  serp: {
    id: "serp",
    discoverQuery: "google search results serp keywords",
    label: "search results",
    queryAliases: ["query", "q", "keyword", "keywords", "searchTerms", "search", "term"],
    limitAliases: ["limit", "maxItems", "maxResults", "resultsLimit", "num", "count"],
    arrayAliases: ["keywords", "searchTerms"],
  },
  jobs: {
    id: "jobs",
    discoverQuery: "job postings hiring company",
    label: "hiring signals",
    queryAliases: ["query", "q", "keywords", "search", "title", "jobTitle", "company"],
    limitAliases: ["limit", "maxItems", "maxResults", "resultsLimit"],
    arrayAliases: ["keywords"],
  },
  company: {
    id: "company",
    discoverQuery: "company profile enrichment domain",
    label: "company lookup",
    queryAliases: ["domain", "companyDomain", "query", "q", "url", "website", "name"],
    limitAliases: ["limit", "maxItems", "maxResults"],
  },
  social: {
    id: "social",
    discoverQuery: "social posts search",
    label: "social listening",
    queryAliases: ["searchTerms", "keywords", "query", "q", "search", "hashtags"],
    limitAliases: ["maxItems", "maxResults", "limit", "resultsLimit"],
    arrayAliases: ["searchTerms", "keywords", "hashtags"],
  },
  reviews: {
    id: "reviews",
    discoverQuery: "business reviews scraper",
    label: "review monitoring",
    queryAliases: ["query", "q", "search", "searchTerms", "url", "placeUrl"],
    limitAliases: ["maxItems", "maxResults", "limit", "resultsLimit"],
    arrayAliases: ["searchTerms"],
  },
};

/**
 * Where a resolved endpoint is remembered.
 *
 * Discovery is a network call that returns the same answer for hours, and doing
 * it on every agent run would triple the latency of every job for nothing. The
 * cache is per-process and short-lived on purpose: a serverless instance that
 * lives ten minutes gets one discovery, and a catalogue that improves is picked
 * up on the next cold start rather than never.
 */
const resolved = new Map<string, { endpoint: MonidEndpoint; at: number }>();
const RESOLVE_TTL_MS = 30 * 60_000;

async function resolveEndpoint(
  apiKey: string,
  capability: Capability,
): Promise<MonidEndpoint | null> {
  const cached = resolved.get(capability.id);
  if (cached && Date.now() - cached.at < RESOLVE_TTL_MS) return cached.endpoint;

  const found = await discover(apiKey, capability.discoverQuery, { limit: 8 });
  const best = found[0];
  if (!best) return null;

  resolved.set(capability.id, { endpoint: best, at: Date.now() });
  return best;
}

/** Every field name the endpoint declares, and where each one belongs. */
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

/** The first alias the endpoint actually declares, or null if it declares none. */
function pickAlias(slots: Map<string, Slot>, aliases: string[]): string | null {
  for (const alias of aliases) if (slots.has(alias)) return alias;

  // Case-insensitive second pass. Providers are inconsistent about camelCase,
  // and missing a field over capitalisation would abandon a usable endpoint.
  const lower = new Map([...slots.keys()].map((k) => [k.toLowerCase(), k]));
  for (const alias of aliases) {
    const hit = lower.get(alias.toLowerCase());
    if (hit) return hit;
  }
  return null;
}

export interface CapabilityResult {
  ok: boolean;
  /** The rows the endpoint returned, normalised out of its wrapper shape. */
  rows: Record<string, unknown>[];
  /** Which provider and endpoint actually served this, for the audit trail. */
  via: string | null;
  /** What the run cost, so the founder's ledger can record it. */
  cost: number;
  /** One line explaining an empty result. Null when it worked. */
  reason: string | null;
}

const EMPTY = (reason: string): CapabilityResult => ({
  ok: false,
  rows: [],
  via: null,
  cost: 0,
  reason,
});

/**
 * Ask Monid for one capability, and hand back rows.
 *
 * One query per call, with a small explicit limit. That is not timidity — most
 * of the catalogue bills per result and applies the limit *per query*, so an
 * array of three search terms with a limit of ten is thirty results and three
 * times the bill. A caller that wants breadth should call this more than once
 * and see each cost, rather than discover the multiplication on an invoice.
 */
export async function runCapability(
  apiKey: string,
  capabilityId: keyof typeof CAPABILITIES,
  params: CapabilityParams,
  budgetMs = 60_000,
): Promise<CapabilityResult> {
  const capability = CAPABILITIES[capabilityId];
  if (!capability) return EMPTY(`No such capability: ${capabilityId}.`);
  if (!params.query.trim()) return EMPTY("Nothing to search for.");

  let endpoint: MonidEndpoint | null;
  try {
    endpoint = await resolveEndpoint(apiKey, capability);
  } catch (error) {
    return EMPTY(error instanceof Error ? error.message : "Monid discovery failed.");
  }
  if (!endpoint) return EMPTY(`Monid has nothing for ${capability.label} right now.`);

  const via = `${endpoint.provider}${endpoint.endpoint}`;

  let schema;
  try {
    const detail = await inspect(apiKey, endpoint.provider, endpoint.endpoint);
    schema = detail.input ?? {};
  } catch (error) {
    return EMPTY(error instanceof Error ? error.message : "Could not read the Monid schema.");
  }

  const slots = schemaSlots(schema);
  const queryField = pickAlias(slots, capability.queryAliases);

  // No place to put the search term means we do not understand this endpoint.
  // Stopping here is the whole point: firing anyway would spend real money to
  // get back whatever that endpoint returns for empty input.
  if (!queryField) {
    return {
      ...EMPTY(
        `Monid's ${via} does not take a search term this code recognises ` +
          `(it declares: ${[...slots.keys()].slice(0, 8).join(", ") || "nothing"}).`,
      ),
      via,
    };
  }

  const input: { body: Record<string, unknown>; queryParams: Record<string, unknown>; pathParams: Record<string, unknown> } =
    { body: {}, queryParams: {}, pathParams: {} };

  const place = (field: string, value: unknown) => {
    const slot = slots.get(field) ?? "body";
    input[slot][field] = value;
  };

  const wantsArray = capability.arrayAliases?.some(
    (a) => a.toLowerCase() === queryField.toLowerCase(),
  );
  place(queryField, wantsArray ? [params.query] : params.query);

  const limitField = pickAlias(slots, capability.limitAliases);
  if (limitField) place(limitField, Math.max(1, Math.min(params.limit ?? 10, 25)));

  // Extras only when the endpoint asked for them by that exact name. Anything
  // else is dropped rather than guessed at — an unknown field is at best
  // ignored and at worst changes what is billed.
  for (const [key, value] of Object.entries(params.extra ?? {})) {
    if (slots.has(key)) place(key, value);
  }

  try {
    const run = await runAndWait(
      apiKey,
      endpoint.provider,
      endpoint.endpoint,
      input,
      budgetMs,
    );
    const failure = failureOf(run);
    return {
      ok: !failure,
      rows: rowsOf(run),
      via,
      cost: costOf(run),
      reason: failure,
    };
  } catch (error) {
    return {
      ...EMPTY(error instanceof Error ? error.message : "The Monid run failed."),
      via,
    };
  }
}

/**
 * Rows rendered for a model to write from.
 *
 * Deliberately field-agnostic. Every provider names things differently and the
 * chosen endpoint can change between runs, so pinning to `full_name` or `title`
 * would break silently the first time discovery picked a different vendor.
 * Instead the row's own keys are printed, trimmed to what is readable.
 */
export function rowsBlock(rows: Record<string, unknown>[], max = 12): string {
  return rows
    .slice(0, max)
    .map((row, index) => {
      const fields = Object.entries(row)
        .filter(([, v]) => v != null && v !== "" && typeof v !== "object")
        .slice(0, 10)
        .map(([k, v]) => `  ${k}: ${String(v).slice(0, 160)}`)
        .join("\n");
      return `${index + 1}.\n${fields}`;
    })
    .join("\n\n");
}
