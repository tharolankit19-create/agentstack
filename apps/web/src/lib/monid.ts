import "server-only";

/**
 * Monid — one key, hundreds of data tools.
 *
 * Every capability the squads need from the outside world has been a separate
 * account so far: Apollo for people, Firecrawl for pages, Xquik for posts. Each
 * one is another signup, another key, another bill, and a founder who has not
 * connected it gets an agent that quietly does a worse job. Monid is a single
 * catalogue in front of all of it — one key, one balance, and the tool is
 * chosen at run time rather than at signup time.
 *
 * The CLI is the documented interface; this is the REST API underneath it, which
 * is what a serverless function can actually call. Four calls matter — discover
 * an endpoint, inspect its schema, start a run, read the run.
 *
 * **The paths are learned, not assumed, and that is deliberate.** Monid
 * publishes a CLI reference rather than a REST reference, so every path here
 * was originally read off the CLI bundle and never once confirmed against the
 * live service — which is exactly how this silently did nothing. Probing the
 * API from outside cannot settle it either: `api.monid.ai` rejects on key
 * format before it routes, so every path, real or invented, answers 401
 * identically.
 *
 * So each operation carries the candidate shapes it might have, `call` tries
 * them in order, and the one that answers is remembered for the life of the
 * process. Fall-through happens **only on 404 and 405** — "no such route". A
 * 401, 402 or 400 is a real answer from a real route, and trying three more
 * paths after one would turn "your key is wrong" into "nothing works", which
 * is the failure this is here to end.
 *
 * A run is asynchronous and takes 1–120 seconds, so nothing here blocks on one
 * for longer than the caller's budget allows. Every agent job that uses Monid
 * runs on a cron with minutes to spare, which is exactly the shape Monid's own
 * guidance says to use the fire-and-poll path for.
 *
 * Money is the thing to be careful about. Runs spend the founder's balance, and
 * most endpoints charge per *result* with limits applied per query rather than
 * per call — so a careless array of search terms multiplies the bill. Every
 * helper here passes one query at a time with a small explicit limit, and the
 * cost of each run is returned so the caller can record what it spent.
 */

const BASE_URL = process.env.MONID_BASE_URL?.trim() || "https://api.monid.ai";

/** Runs that will never change again. Polling past one of these is waste. */
// Both spellings of the timeout state. The CLI reference says TIMED_OUT and the
// bundle said TIME_OUT; treating the wrong one as non-terminal would poll a
// finished run until the budget ran out and then report it as still running.
const TERMINAL = new Set([
  "COMPLETED",
  "FAILED",
  "BLOCKED",
  "STOPPED",
  "TIME_OUT",
  "TIMED_OUT",
]);

export interface MonidEndpoint {
  provider: string;
  endpoint: string;
  description?: string;
  price?: unknown;
  verified?: boolean;
  score?: number;
  metrics?: { health?: string; median?: number; tail?: number };
}

export interface MonidRun {
  runId: string;
  status: string;
  /** Whatever the endpoint returned. Shape is per-endpoint. */
  results?: unknown;
  output?: unknown;
  cost?: { value?: number; currency?: string };
  /** Present when status is BLOCKED: which workspace control stopped it. */
  controls?: { controlId?: string; snapshot?: unknown }[];
  stoppable?: boolean;
  error?: { code?: string; message?: string };
}

export class MonidError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "MonidError";
  }
}

/**
 * One way an operation might be addressed.
 *
 * `body` transforms the logical arguments into whatever this shape expects —
 * the two candidate APIs differ in the envelope as well as the path, so a
 * variant that only carried a path would still send the wrong request.
 */
export interface Route {
  method: "GET" | "POST";
  path: (args: Record<string, string>) => string;
  body?: (input: Record<string, unknown>) => unknown;
}

/**
 * Which variant answered, remembered per operation.
 *
 * Process-scoped. A serverless cold start re-learns it at the cost of one 404,
 * which is the right trade against a cache that can go stale and pin the whole
 * platform to a route that has since moved.
 */
const learned = new Map<string, number>();

/** For the diagnostics page: what has been learned so far, and what is still guesswork. */
export function learnedRoutes(): Record<string, number> {
  return Object.fromEntries(learned);
}

/** A route answered "no such thing" — try the next shape. Anything else is real. */
function isMissingRoute(status: number): boolean {
  return status === 404 || status === 405;
}

async function callRoutes<T>(
  apiKey: string,
  operation: string,
  routes: Route[],
  args: Record<string, string> = {},
  input: Record<string, unknown> = {},
  timeoutMs = 30_000,
): Promise<T> {
  // The learned variant first, then the rest — so a process that has already
  // found the answer pays nothing, and one that has not still finds it.
  const remembered = learned.get(operation);
  const order =
    remembered === undefined
      ? routes.map((_, i) => i)
      : [remembered, ...routes.map((_, i) => i).filter((i) => i !== remembered)];

  let lastMissing: MonidError | null = null;

  for (const index of order) {
    const route = routes[index];
    try {
      const result = await call<T>(
        apiKey,
        route.method,
        route.path(args),
        route.body ? route.body(input) : undefined,
        timeoutMs,
      );
      learned.set(operation, index);
      return result;
    } catch (cause) {
      if (cause instanceof MonidError && cause.status && isMissingRoute(cause.status)) {
        lastMissing = cause;
        continue;
      }
      // A real answer — auth, billing, a bad argument. Stop here and report it
      // rather than burying it under three more requests.
      throw cause;
    }
  }

  throw new MonidError(
    `Monid has no route for ${operation}. Tried ${routes.length} known shapes; ` +
      `the last said: ${lastMissing?.message ?? "not found"}. ` +
      `Check /api/diagnostics/monid for the exact responses.`,
    404,
  );
}

async function call<T>(
  apiKey: string,
  method: "GET" | "POST",
  path: string,
  body?: unknown,
  timeoutMs = 30_000,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        // Monid asks callers to identify themselves; this is not the CLI.
        "X-Monid-Client": "agentstack",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (cause) {
    const timedOut = cause instanceof Error && cause.name === "TimeoutError";
    throw new MonidError(timedOut ? "Monid took too long to answer." : "Could not reach Monid.");
  }

  if (response.status === 204) return undefined as T;

  const data = (await response.json().catch(() => ({}))) as {
    error?: { code?: string; message?: string };
    message?: string;
  };

  if (!response.ok) {
    // 401 is the one a founder can fix themselves, so it says so plainly.
    const message =
      response.status === 401
        ? "Monid rejected the API key. Check it at app.monid.ai/access/api-keys."
        : data.error?.message ?? data.message ?? `Monid returned ${response.status}.`;
    throw new MonidError(message, response.status, data.error?.code);
  }

  return data as T;
}

/**
 * Every shape each operation might have.
 *
 * Two families, in order. First the one read off the CLI bundle, because that
 * is what this was built against and what a working deployment may already be
 * using. Then the one implied by the published CLI reference — resource-style
 * paths, `/v1/tools`, `/v1/runs`, `/v1/workspace/balance` — with the flattened
 * body that reference describes.
 *
 * Adding a third family is one entry, not a refactor. That is the point of
 * writing them down rather than hard-coding the winner.
 */
const ROUTES: Record<string, Route[]> = {
  whoami: [
    { method: "GET", path: () => "/v1/auth/whoami" },
    { method: "GET", path: () => "/v1/me" },
    { method: "GET", path: () => "/v1/workspace" },
  ],
  balance: [
    { method: "GET", path: () => "/v1/wallet/balance" },
    { method: "GET", path: () => "/v1/workspace/balance" },
    { method: "GET", path: () => "/v1/balance" },
  ],
  discover: [
    {
      method: "POST",
      path: () => "/v1/discover",
      body: (input) => ({ query: input.query, limit: input.limit }),
    },
    {
      method: "GET",
      path: (args) =>
        `/v1/tools?query=${encodeURIComponent(args.query)}&limit=${encodeURIComponent(args.limit)}`,
    },
    {
      method: "POST",
      path: () => "/v1/tools/search",
      body: (input) => ({ query: input.query, limit: input.limit }),
    },
  ],
  inspect: [
    {
      method: "POST",
      path: () => "/v1/inspect",
      body: (input) => ({ provider: input.provider, endpoint: input.endpoint }),
    },
    {
      method: "GET",
      path: (args) =>
        `/v1/tools/${encodeURIComponent(args.provider)}/${encodeURIComponent(args.endpoint)}`,
    },
  ],
  startRun: [
    { method: "POST", path: () => "/v1/run", body: (input) => input.nested },
    { method: "POST", path: () => "/v1/runs", body: (input) => input.flat },
  ],
  getRun: [
    { method: "GET", path: (args) => `/v1/runs/${encodeURIComponent(args.runId)}` },
    { method: "GET", path: (args) => `/v1/run/${encodeURIComponent(args.runId)}` },
  ],
};

/** The operations a diagnostics run should exercise, cheapest first. */
export const FREE_OPERATIONS = ["whoami", "balance"] as const;

/** Whether a key works at all, without spending anything. */
export async function whoami(apiKey: string): Promise<boolean> {
  try {
    await callRoutes(apiKey, "whoami", ROUTES.whoami, {}, {}, 12_000);
    return true;
  } catch {
    return false;
  }
}

/** What is left to spend. Free to call. */
export async function balance(apiKey: string): Promise<unknown> {
  return callRoutes(apiKey, "balance", ROUTES.balance, {}, {}, 12_000);
}

/**
 * What an endpoint charges, as a number we can sort by.
 *
 * The catalogue reports price in whatever shape each provider uses — a bare
 * number, a string with a currency symbol, or an object with the amount under
 * one of several names. Anything unreadable comes back as Infinity rather than
 * zero: an unknown price sorting first would make "cheapest" quietly mean
 * "price we failed to parse", which is the opposite of the intent.
 */
export function priceOf(endpoint: MonidEndpoint): number {
  const raw = endpoint.price;
  if (raw == null) return Number.POSITIVE_INFINITY;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : Number.POSITIVE_INFINITY;

  if (typeof raw === "string") {
    if (/free/i.test(raw)) return 0;
    const found = raw.match(/[\d.]+/);
    return found ? Number(found[0]) : Number.POSITIVE_INFINITY;
  }

  if (typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    for (const key of ["value", "amount", "usd", "perResult", "per_result", "cost"]) {
      const v = obj[key];
      if (typeof v === "number" && Number.isFinite(v)) return v;
      if (typeof v === "string") {
        const found = v.match(/[\d.]+/);
        if (found) return Number(found[0]);
      }
    }
  }

  return Number.POSITIVE_INFINITY;
}

export interface DiscoverOptions {
  limit?: number;
  /**
   * Sort by price before relevance, so free and cheap endpoints win.
   *
   * On by default. While a founder is testing, an endpoint that costs nothing
   * and returns something is worth more than a premium one that returns
   * something slightly better — and the difference between the two is a bill
   * they did not expect from an army that runs unattended every few minutes.
   */
  cheapestFirst?: boolean;
}

/**
 * Find endpoints for a need, cheapest usable one first.
 *
 * Short noun phrases work best — "linkedin company employees", not a sentence.
 *
 * Three signals, in this order: price, then health, then the catalogue's own
 * relevance. Price leads because these run unattended on a schedule, where the
 * cost of a wrong default is charged every few minutes rather than once.
 *
 * Health breaks ties and never filters. An `unknown` status usually means low
 * traffic rather than a problem, so dropping those would throw away most of a
 * catalogue that grows continuously — but a `degraded` endpoint loses to a
 * healthy one at the same price.
 */
export async function discover(
  apiKey: string,
  query: string,
  options: DiscoverOptions = {},
): Promise<MonidEndpoint[]> {
  const { limit = 8, cheapestFirst = true } = options;

  const data = await callRoutes<{ results?: MonidEndpoint[]; tools?: MonidEndpoint[] }>(
    apiKey,
    "discover",
    ROUTES.discover,
    { query, limit: String(limit) },
    { query, limit },
  );

  const health = (e: MonidEndpoint) => {
    const status = e.metrics?.health ?? "unknown";
    if (status === "healthy") return 0;
    if (status === "stable") return 1;
    if (status === "degraded") return 3;
    return 2; // unknown sits above degraded, below confirmed-good.
  };

  // The two families name the array differently. Neither is wrong; both are read.
  const results = [...(data.results ?? data.tools ?? [])];

  results.sort((a, b) => {
    if (cheapestFirst) {
      const priceGap = priceOf(a) - priceOf(b);
      // NaN-safe: an Infinity-vs-Infinity comparison is 0, not a thrown sort.
      if (Number.isFinite(priceGap) && priceGap !== 0) return priceGap;
      if (priceOf(a) !== priceOf(b)) return priceOf(a) < priceOf(b) ? -1 : 1;
    }
    const healthGap = health(a) - health(b);
    if (healthGap !== 0) return healthGap;
    return (b.score ?? 0) - (a.score ?? 0);
  });

  return results;
}

/** The input schema for one endpoint: where each parameter actually goes. */
export async function inspect(
  apiKey: string,
  provider: string,
  endpoint: string,
): Promise<{
  input?: {
    body?: Record<string, unknown>;
    queryParams?: Record<string, unknown>;
    pathParams?: Record<string, unknown>;
    bodyType?: string;
  };
}> {
  return callRoutes(
    apiKey,
    "inspect",
    ROUTES.inspect,
    { provider, endpoint },
    { provider, endpoint },
  );
}

export interface RunInput {
  body?: Record<string, unknown>;
  queryParams?: Record<string, unknown>;
  pathParams?: Record<string, unknown>;
}

/** Start a run. Returns immediately with an id — it is not finished yet. */
export async function startRun(
  apiKey: string,
  provider: string,
  endpoint: string,
  input: RunInput = {},
): Promise<MonidRun> {
  const payload: Record<string, unknown> = { provider, endpoint };

  const trimmed: RunInput = {};
  if (input.body && Object.keys(input.body).length) trimmed.body = input.body;
  if (input.queryParams && Object.keys(input.queryParams).length) {
    trimmed.queryParams = input.queryParams;
  }
  if (input.pathParams && Object.keys(input.pathParams).length) {
    trimmed.pathParams = input.pathParams;
  }
  // Two envelopes for the same arguments: the bundle nests everything under
  // `input`, the CLI reference spreads body/queryParams/pathParams at the top
  // level. Both are built here so whichever route answers gets what it expects.
  const nested = { ...payload, ...(Object.keys(trimmed).length ? { input: trimmed } : {}) };
  const flat = { ...payload, ...trimmed };

  return callRoutes<MonidRun>(apiKey, "startRun", ROUTES.startRun, {}, { nested, flat });
}

export async function getRun(apiKey: string, runId: string): Promise<MonidRun> {
  return callRoutes<MonidRun>(apiKey, "getRun", ROUTES.getRun, { runId });
}

/**
 * Start a run and wait for it, within a budget.
 *
 * Backs off from two seconds to eight so a fast endpoint returns fast and a slow
 * one is not hammered. Returns whatever the run looked like when the budget ran
 * out rather than throwing — a caller that has spent its time deserves to know
 * the run is still going, and the cost is already committed either way.
 *
 * BLOCKED is terminal and returns immediately: a workspace budget or run cap
 * stopped it, and it will not proceed on its own no matter how long anyone
 * waits.
 */
export async function runAndWait(
  apiKey: string,
  provider: string,
  endpoint: string,
  input: RunInput = {},
  budgetMs = 60_000,
): Promise<MonidRun> {
  const started = await startRun(apiKey, provider, endpoint, input);
  if (!started.runId || TERMINAL.has(started.status)) return started;

  const deadline = Date.now() + budgetMs;
  let wait = 2_000;
  let latest = started;

  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, Math.min(wait, deadline - Date.now())));
    if (Date.now() >= deadline) break;

    try {
      latest = await getRun(apiKey, started.runId);
    } catch {
      // A failed poll is not a failed run. Try again while budget remains.
      continue;
    }

    if (TERMINAL.has(latest.status)) return latest;
    wait = Math.min(wait * 1.5, 8_000);
  }

  return latest;
}

/**
 * The rows a run produced, whatever shape the endpoint chose to return them in.
 *
 * Every provider in the catalogue answers differently — a bare array, `{items}`,
 * `{data}`, `{results}`, or a single object. Callers should not each guess, so
 * the guessing happens once, here, and anything unrecognised comes back as a
 * one-element array rather than being silently dropped.
 */
export function rowsOf(run: MonidRun): Record<string, unknown>[] {
  const payload = run.results ?? run.output;
  if (payload == null) return [];

  const unwrap = (value: unknown): unknown => {
    if (Array.isArray(value)) return value;
    if (value && typeof value === "object") {
      const obj = value as Record<string, unknown>;
      for (const key of ["items", "data", "results", "records", "rows"]) {
        if (Array.isArray(obj[key])) return obj[key];
      }
    }
    return value;
  };

  const unwrapped = unwrap(payload);
  if (Array.isArray(unwrapped)) {
    return unwrapped.filter((r): r is Record<string, unknown> => Boolean(r) && typeof r === "object");
  }
  return typeof unwrapped === "object" ? [unwrapped as Record<string, unknown>] : [];
}

/** What a run cost, for the founder's ledger. Zero when Monid reported none. */
export function costOf(run: MonidRun): number {
  return typeof run.cost?.value === "number" ? run.cost.value : 0;
}

/** A one-line reason a run produced nothing, or null when it succeeded. */
export function failureOf(run: MonidRun): string | null {
  if (run.status === "COMPLETED") return null;
  if (run.status === "BLOCKED") {
    return "A Monid workspace control (budget or run cap) blocked the run. Adjust it at app.monid.ai.";
  }
  if (run.status === "TIME_OUT") return "The Monid run timed out.";
  if (run.status === "FAILED") return run.error?.message ?? "The Monid run failed.";
  if (run.status === "STOPPED") return "The Monid run was stopped.";
  return `The Monid run is still ${run.status.toLowerCase()}.`;
}
