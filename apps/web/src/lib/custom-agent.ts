import OpenAI from "openai";
import * as cheerio from "cheerio";
import type { CustomAgentSpec } from "./supabase/types";

/**
 * The Custom Agent Builder.
 *
 * A customer names a SaaS they already pay for. We read its marketing site and
 * whatever documentation we can find, and generate an agent spec that does the
 * same job — which the runtime then treats exactly like a built-in template.
 *
 * The honest framing, which the generated prompt also carries: this reads
 * public pages. It produces a good agent for products with public docs and a
 * thin one for products without. It never guesses an endpoint into existence.
 */

const USER_AGENT =
  "Mozilla/5.0 (compatible; AgentStackBot/1.0; +https://agentstack.dev/bot)";

/** Paths worth trying when a product's docs are not linked from the homepage. */
const DOC_GUESSES = [
  "/docs",
  "/docs/api",
  "/api",
  "/api-docs",
  "/developers",
  "/developer",
  "/reference",
  "/pricing",
];

export interface BuildResult {
  spec: CustomAgentSpec;
  sources: string[];
}

export async function buildCustomAgent(input: {
  sourceUrl: string;
  apiBaseUrl?: string;
  hasApiKey: boolean;
  openaiKey: string;
}): Promise<BuildResult> {
  const root = safeUrl(input.sourceUrl);
  const pages = await readSite(root);

  if (pages.length === 0) {
    throw new Error(
      `Could not read anything from ${root.host}. The site may block bots or ` +
        "render entirely in JavaScript. Try linking its documentation directly.",
    );
  }

  const spec = await generateSpec({
    host: root.host,
    pages,
    apiBaseUrl: input.apiBaseUrl,
    hasApiKey: input.hasApiKey,
    openaiKey: input.openaiKey,
  });

  return { spec, sources: pages.map((page) => page.url) };
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

interface Page {
  url: string;
  title: string;
  text: string;
}

async function readSite(root: URL): Promise<Page[]> {
  const home = await readPage(root.toString());
  if (!home) return [];

  const candidates = new Set<string>();

  // Links the site itself offers are better than anything we can guess.
  for (const href of home.links) {
    if (!/doc|api|develop|reference|guide|pricing|integrat/i.test(href)) continue;
    try {
      const url = new URL(href, root);
      if (url.host === root.host) candidates.add(stripHash(url.toString()));
    } catch {
      /* skip malformed hrefs */
    }
  }
  for (const guess of DOC_GUESSES) {
    candidates.add(new URL(guess, root).toString());
  }

  const shortlist = [...candidates].slice(0, 8);
  const fetched = await Promise.all(shortlist.map((url) => readPage(url)));

  const pages: Page[] = [{ url: home.url, title: home.title, text: home.text }];
  for (const page of fetched) {
    if (!page || page.text.length < 300) continue;
    if (pages.some((p) => p.url === page.url)) continue;
    pages.push({ url: page.url, title: page.title, text: page.text });
    if (pages.length >= 6) break;
  }

  return pages;
}

async function readPage(
  url: string,
): Promise<{ url: string; title: string; text: string; links: string[] } | null> {
  try {
    const response = await fetch(url, {
      headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml" },
      redirect: "follow",
      signal: AbortSignal.timeout(12_000),
    });

    if (!response.ok) return null;
    if (!(response.headers.get("content-type") ?? "").includes("html")) return null;

    const html = (await response.text()).slice(0, 1_200_000);
    const $ = cheerio.load(html);

    const links: string[] = [];
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href");
      if (href) links.push(href);
    });

    $("script, style, noscript, svg, iframe").remove();

    return {
      url,
      title: $("title").first().text().trim(),
      text: $("body").text().replace(/\s+/g, " ").trim().slice(0, 12_000),
      links,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Generating
// ---------------------------------------------------------------------------

async function generateSpec(input: {
  host: string;
  pages: Page[];
  apiBaseUrl?: string;
  hasApiKey: boolean;
  openaiKey: string;
}): Promise<CustomAgentSpec> {
  const client = new OpenAI({
    apiKey: input.openaiKey,
    baseURL: process.env.OPENAI_BASE_URL || undefined,
    timeout: 90_000,
    maxRetries: 1,
  });

  const corpus = input.pages
    .map((page) => `### ${page.title || page.url}\n${page.url}\n\n${page.text.slice(0, 6_000)}`)
    .join("\n\n---\n\n");

  const completion = await client.chat.completions.create({
    model: process.env.CUSTOM_AGENT_MODEL || "gpt-4o-mini",
    temperature: 0.3,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You design AI agents that replace SaaS products. Given the public " +
          "pages of a product, you work out what job people hire it to do, and " +
          "you write the system prompt for an agent that does that job.\n\n" +
          "Hard rules:\n" +
          "- Only describe capabilities the pages actually evidence.\n" +
          "- Only list API endpoints you literally saw documented. An invented " +
          "endpoint produces an agent that 404s on its first run, which is " +
          "worse than an agent with no API at all. An empty list is a fine answer.\n" +
          "- Never invent pricing. If you did not read a price, use 0.\n" +
          "- The system prompt you write is the whole agent. Make it specific, " +
          "give it a working procedure, and tell it what never to do.",
      },
      {
        role: "user",
        content:
          `Product host: ${input.host}\n` +
          (input.apiBaseUrl ? `The customer says its API base URL is: ${input.apiBaseUrl}\n` : "") +
          `The customer ${input.hasApiKey ? "HAS" : "has NOT"} given us an API key for it.\n\n` +
          `Public pages:\n\n${corpus}\n\n` +
          "Return JSON with exactly these keys:\n" +
          "{\n" +
          '  "name": "<agent name, e.g. \\"Scheduling Agent\\" — the job, not the brand>",\n' +
          '  "description": "<one plain sentence: what it does for the customer>",\n' +
          '  "replaces": { "tools": ["<product name>"], "monthlyUsd": <cheapest paid plan you actually read, else 0> },\n' +
          '  "systemPrompt": "<the full system prompt. Include: who the agent is, a numbered working procedure, and an explicit list of things it must never do or invent. 200-500 words.>",\n' +
          '  "scheduledTask": "<the one instruction it runs on a schedule>",\n' +
          '  "examples": ["<3 things a user would ask it>"],\n' +
          '  "api": { "baseUrl": "<only if documented or supplied>", "auth": "bearer|header|query|none", "authName": "<header/param name if not bearer>", "endpoints": [{ "method": "GET", "path": "/v1/x", "purpose": "..." }] }\n' +
          "}\n\n" +
          'Omit "api" entirely if you found no documented API.',
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  return normalize(JSON.parse(raw) as Record<string, unknown>, input);
}

/**
 * The model's output is input, not truth. Everything is clamped to the shape
 * the runtime expects before it is stored.
 */
function normalize(
  parsed: Record<string, unknown>,
  input: { host: string; pages: Page[]; apiBaseUrl?: string },
): CustomAgentSpec {
  const replaces = asRecord(parsed.replaces);
  const api = asRecord(parsed.api);
  const baseUrl = input.apiBaseUrl || str(api.baseUrl);

  const spec: CustomAgentSpec = {
    id: "custom-agent",
    name: str(parsed.name) || `${input.host} Agent`,
    description: str(parsed.description) || `An agent that replaces ${input.host}.`,
    replaces: {
      tools: Array.isArray(replaces.tools)
        ? replaces.tools.map(String).filter(Boolean).slice(0, 4)
        : [input.host],
      monthlyUsd: clampPrice(replaces.monthlyUsd),
    },
    systemPrompt: str(parsed.systemPrompt) || fallbackPrompt(input.host),
    scheduledTask:
      str(parsed.scheduledTask) ||
      "Do the job described in your instructions and report what you did.",
    examples: Array.isArray(parsed.examples)
      ? parsed.examples.map(String).filter(Boolean).slice(0, 5)
      : [],
    sources: input.pages.map((page) => page.url),
  };

  if (baseUrl) {
    let normalizedBase: string;
    try {
      normalizedBase = safeUrl(baseUrl).toString();
    } catch {
      return spec; // An unusable base URL means an agent with no API, not a crash.
    }

    const auth = str(api.auth);
    spec.api = {
      baseUrl: normalizedBase,
      auth:
        auth === "header" || auth === "query" || auth === "none" ? auth : "bearer",
      authName: str(api.authName) || undefined,
      endpoints: Array.isArray(api.endpoints)
        ? api.endpoints
            .map((entry) => {
              const record = asRecord(entry);
              return {
                method: (str(record.method) || "GET").toUpperCase(),
                path: str(record.path),
                purpose: str(record.purpose),
              };
            })
            .filter((entry) => entry.path.startsWith("/"))
            .slice(0, 40)
        : [],
    };
  }

  return spec;
}

function fallbackPrompt(host: string): string {
  return (
    `You are an agent that does the job people hire ${host} to do.\n\n` +
    "We could not read enough of that product's documentation to be specific, " +
    "so ask the user what they used it for before doing anything. Never invent " +
    "capabilities, data, or API responses."
  );
}

function clampPrice(value: unknown): number {
  const price = Number(value);
  // A four-figure "monthly price" from a model is almost always an annual
  // contract it misread. Cap it rather than print a savings number we cannot stand behind.
  if (!Number.isFinite(price) || price < 0) return 0;
  return Math.min(Math.round(price), 999);
}

export function safeUrl(input: string): URL {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("No URL was given.");
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    throw new Error(`"${input}" is not a valid URL.`);
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Only http and https URLs work here.");
  }

  // This fetches a URL a customer supplied, from inside our network.
  const host = parsed.hostname.toLowerCase();
  const isPrivate =
    host === "localhost" ||
    host === "0.0.0.0" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /^\[?::1\]?$/.test(host);

  if (isPrivate) throw new Error("That address is not reachable from here.");
  return parsed;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function stripHash(url: string): string {
  return url.split("#")[0];
}
