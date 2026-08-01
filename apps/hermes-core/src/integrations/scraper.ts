import * as cheerio from "cheerio";

/**
 * Website and review-page scraping.
 *
 * Fetch + parse, nothing heavier. A headless browser would double the cold
 * start of every agent to serve the minority of pages that need it.
 */

const USER_AGENT =
  "Mozilla/5.0 (compatible; AgentStackBot/1.0; +https://agentstack.dev/bot)";
const MAX_BYTES = 2_000_000;

export interface PageContent {
  url: string;
  title: string;
  description: string;
  headings: string[];
  text: string;
  links: string[];
}

export async function fetchPage(
  url: string,
  signal?: AbortSignal,
): Promise<PageContent> {
  const target = normalizeUrl(url);

  const response = await fetch(target, {
    headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml" },
    redirect: "follow",
    signal: signal ?? AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    throw new Error(`${target} returned HTTP ${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("html") && !contentType.includes("xml")) {
    throw new Error(`${target} is ${contentType || "an unknown type"}, not HTML`);
  }

  const html = (await response.text()).slice(0, MAX_BYTES);
  return parseHtml(target, html);
}

export function parseHtml(url: string, html: string): PageContent {
  const $ = cheerio.load(html);
  $("script, style, noscript, svg, iframe, nav, footer").remove();

  const headings: string[] = [];
  $("h1, h2, h3").each((_, el) => {
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (text) headings.push(text);
  });

  const links: string[] = [];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    try {
      links.push(new URL(href, url).toString());
    } catch {
      /* skip malformed hrefs */
    }
  });

  return {
    url,
    title: $("title").first().text().trim() || $("h1").first().text().trim(),
    description:
      $('meta[name="description"]').attr("content")?.trim() ||
      $('meta[property="og:description"]').attr("content")?.trim() ||
      "",
    headings: headings.slice(0, 40),
    text: $("body").text().replace(/\s+/g, " ").trim().slice(0, 20_000),
    links: [...new Set(links)].slice(0, 100),
  };
}

/** Flattens a page into the compact brief a prompt actually wants. */
export function toBrief(page: PageContent, limit = 6_000): string {
  return [
    `URL: ${page.url}`,
    page.title && `Title: ${page.title}`,
    page.description && `Description: ${page.description}`,
    page.headings.length && `Headings:\n- ${page.headings.slice(0, 20).join("\n- ")}`,
    `Content:\n${page.text.slice(0, limit)}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("No URL was provided.");
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    throw new Error(`"${input}" is not a valid URL.`);
  }

  // An agent runs with the deployment's network identity, so a model-supplied
  // URL must not be allowed to reach the platform's own internal addresses.
  const host = parsed.hostname.toLowerCase();
  const blocked =
    host === "localhost" ||
    host === "0.0.0.0" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host === "metadata.google.internal";

  if (blocked) throw new Error(`Refusing to fetch a private address: ${host}`);
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error(`Unsupported protocol: ${parsed.protocol}`);
  }
  return parsed.toString();
}
