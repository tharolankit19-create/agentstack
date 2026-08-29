import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/deploy";

/**
 * Who may read this site, and where.
 *
 * The wildcard rule is the whole policy: everything public is open, and the
 * four private areas are not. The AI crawlers are then named explicitly with
 * the same permissions — not to grant them anything the wildcard did not
 * already, but because a named rule is the unambiguous version of an implied
 * one, and several of these bots have shipped changes to how they read a bare
 * wildcard. This product sells search and answer-engine visibility; being
 * quietly absent from the answers because of an inherited default would be the
 * wrong way to find that out.
 *
 * Worth being precise about what this does and does not do: naming a crawler
 * here permits it. It does not rank the site, and it does not get it cited.
 */
const AI_CRAWLERS = [
  // OpenAI: training, live browsing, and the search index respectively.
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  // Anthropic.
  "ClaudeBot",
  "Claude-User",
  "Claude-SearchBot",
  // Perplexity.
  "PerplexityBot",
  "Perplexity-User",
  // Google's AI surfaces read through Googlebot, but this is the opt-in that
  // governs Gemini and Vertex grounding.
  "Google-Extended",
  // The rest of the field.
  "Applebot-Extended",
  "Bingbot",
  "CCBot",
  "cohere-ai",
  "Meta-ExternalAgent",
  "Amazonbot",
];

/** Never indexed: behind the paywall, or not a page at all. */
const PRIVATE = ["/dashboard", "/api/", "/auth/", "/checkout/"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: PRIVATE },
      ...AI_CRAWLERS.map((userAgent) => ({
        userAgent,
        allow: "/",
        disallow: PRIVATE,
      })),
    ],
    sitemap: `${appUrl()}/sitemap.xml`,
    host: appUrl(),
  };
}
