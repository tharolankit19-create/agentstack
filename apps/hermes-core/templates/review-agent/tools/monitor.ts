import * as cheerio from "cheerio";
import { normalizeUrl } from "@/integrations/scraper";
import type { Tool } from "@/core/types";

/**
 * Pulls reviews off a review page.
 *
 * Primary path is JSON-LD: G2, Capterra, Trustpilot and Product Hunt all embed
 * schema.org `Review` objects for Google, which is a far more stable contract
 * than any of their CSS class names. The DOM heuristic below it only exists to
 * degrade gracefully when a page ships no structured data.
 */

export interface ScrapedReview {
  id: string;
  author: string;
  rating: number | null;
  title: string;
  body: string;
  date: string | null;
  hasReply: boolean;
}

export const monitorTool: Tool = {
  name: "check_reviews",
  description:
    "Fetch the current reviews from the configured review page. Returns each " +
    "review with its rating, author, text, and whether it already has a reply. " +
    "Call this first, every run.",
  parameters: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description: "Review page to check. Omit to use the configured URL.",
      },
      onlyUnanswered: {
        type: "boolean",
        description: "Return only reviews with no reply yet. Defaults to true.",
      },
    },
    required: [],
    additionalProperties: false,
  },
  async run(args, ctx) {
    const url = (args.url as string | undefined) || ctx.config.reviewUrl;
    if (!url) {
      throw new Error(
        "No review URL. Set the review page URL in the agent's configuration.",
      );
    }
    const onlyUnanswered = args.onlyUnanswered !== false;

    const reviews = await scrapeReviews(url, ctx.signal);
    ctx.log("reviews.fetched", { url, count: reviews.length });

    const selected = onlyUnanswered ? reviews.filter((r) => !r.hasReply) : reviews;

    if (selected.length === 0) {
      return reviews.length === 0
        ? `No reviews could be read from ${url}. The page may render reviews with ` +
            `JavaScript or require a login. Try the site's public "reviews" URL.`
        : `Found ${reviews.length} reviews, all of which already have replies. Nothing to do.`;
    }

    const rendered = selected
      .map(
        (r, i) =>
          `--- Review ${i + 1} (id: ${r.id}) ---\n` +
          `Rating: ${r.rating ?? "unknown"}/5\n` +
          `Author: ${r.author}\n` +
          `Date: ${r.date ?? "unknown"}\n` +
          (r.title ? `Title: ${r.title}\n` : "") +
          `Text: ${r.body}`,
      )
      .join("\n\n");

    return `Found ${reviews.length} reviews, ${selected.length} without a reply.\n\n${rendered}`;
  },
};

export async function scrapeReviews(
  url: string,
  signal?: AbortSignal,
): Promise<ScrapedReview[]> {
  const target = normalizeUrl(url);
  const response = await fetch(target, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (compatible; AgentStackBot/1.0; +https://agentstack.dev/bot)",
      accept: "text/html,application/xhtml+xml",
    },
    redirect: "follow",
    signal: signal ?? AbortSignal.timeout(25_000),
  });

  if (!response.ok) {
    throw new Error(`${target} returned HTTP ${response.status}`);
  }

  const html = await response.text();
  const structured = fromJsonLd(html);
  return structured.length > 0 ? structured : fromDom(html);
}

function fromJsonLd(html: string): ScrapedReview[] {
  const $ = cheerio.load(html);
  const found: ScrapedReview[] = [];

  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text();
    if (!raw.trim()) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }
    for (const node of flatten(parsed)) collectReviews(node, found);
  });

  return dedupe(found);
}

/** Walks @graph / arrays / nested objects so reviews are found wherever they sit. */
function flatten(node: unknown, depth = 0): unknown[] {
  if (depth > 6 || node === null || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap((n) => flatten(n, depth + 1));

  const out: unknown[] = [node];
  const record = node as Record<string, unknown>;
  for (const key of ["@graph", "review", "reviews", "itemListElement", "mainEntity"]) {
    if (record[key]) out.push(...flatten(record[key], depth + 1));
  }
  return out;
}

function collectReviews(node: unknown, out: ScrapedReview[]): void {
  if (!node || typeof node !== "object") return;
  const record = node as Record<string, unknown>;

  const type = record["@type"];
  const types = Array.isArray(type) ? type.map(String) : [String(type ?? "")];
  if (!types.some((t) => t === "Review" || t === "UserReview")) return;

  const body = str(record.reviewBody ?? record.description ?? record.text);
  if (!body) return;

  out.push({
    id: str(record["@id"]) || hash(body),
    author: readAuthor(record.author) || "Anonymous",
    rating: readRating(record.reviewRating),
    title: str(record.name ?? record.headline),
    body: body.replace(/\s+/g, " ").trim().slice(0, 2_000),
    date: str(record.datePublished ?? record.dateCreated) || null,
    hasReply: Boolean(record.comment) || Boolean(record.replyToUrl),
  });
}

function fromDom(html: string): ScrapedReview[] {
  const $ = cheerio.load(html);
  $("script, style, noscript").remove();

  const selectors = [
    "[itemprop='review']",
    "[data-testid*='review' i]",
    "[class*='review-card' i]",
    "[class*='reviewCard' i]",
    "article[class*='review' i]",
  ];

  const out: ScrapedReview[] = [];
  for (const selector of selectors) {
    $(selector).each((_, el) => {
      const node = $(el);
      const text = node.text().replace(/\s+/g, " ").trim();
      // Anything shorter is navigation chrome, not a review.
      if (text.length < 80 || text.length > 6_000) return;

      const ratingMatch = text.match(/([0-5](?:\.\d)?)\s*(?:out of\s*5|\/\s*5|stars?)/i);
      out.push({
        id: hash(text),
        author:
          node.find("[itemprop='author'], [class*='author' i]").first().text().trim() ||
          "Anonymous",
        rating: ratingMatch ? Number(ratingMatch[1]) : null,
        title: node.find("h2, h3, h4").first().text().trim(),
        body: text.slice(0, 2_000),
        date: node.find("time").first().attr("datetime") ?? null,
        hasReply: /response from|reply from|vendor response/i.test(text),
      });
    });
    if (out.length > 0) break;
  }
  return dedupe(out).slice(0, 25);
}

function dedupe(reviews: ScrapedReview[]): ScrapedReview[] {
  const seen = new Set<string>();
  return reviews.filter((r) => {
    const key = r.body.slice(0, 120);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function readAuthor(author: unknown): string {
  if (typeof author === "string") return author;
  if (author && typeof author === "object") {
    return str((author as Record<string, unknown>).name);
  }
  return "";
}

function readRating(rating: unknown): number | null {
  if (typeof rating === "number") return rating;
  if (rating && typeof rating === "object") {
    const value = (rating as Record<string, unknown>).ratingValue;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  const parsed = Number(rating);
  return Number.isFinite(parsed) ? parsed : null;
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Stable id for a review that has no @id of its own. */
function hash(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `r_${(h >>> 0).toString(36)}`;
}
