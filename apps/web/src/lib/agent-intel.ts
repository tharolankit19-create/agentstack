import "server-only";
import { runCapability, rowsBlock, type CapabilityParams } from "./monid-capabilities";
import { CAPABILITIES } from "./monid-capabilities";

/**
 * What each agent should go and look at before it writes anything.
 *
 * Every squad now reaches the world through one key. Before this, only the lead
 * agent did: the rest were handed a web search and a competitor's homepage if
 * Firecrawl happened to be connected, and otherwise wrote from memory. An agent
 * writing from memory is the exact thing this product is sold against — it
 * produces something fluent about marketing in general rather than something
 * specific about this founder's week.
 *
 * A mapping rather than a call per agent, because the interesting part is
 * *which question each job needs answered*, and that is a short table. The SEO
 * agent needs to see what actually ranks for the keyword; the review agent
 * needs the reviews; the hiring agent needs the postings. Written out, the
 * table is also the honest list of which agents genuinely benefit from live
 * data and which do not — and the ones that do not are left alone rather than
 * given a search to justify the integration.
 */

type CapabilityId = keyof typeof CAPABILITIES;

interface Brief {
  capability: CapabilityId;
  /** Builds the one search term from what the founder has told us. */
  query: (config: Record<string, string>) => string;
  /** How many rows. Small — most of the catalogue bills per result. */
  limit?: number;
  /** How the block is introduced to the model. */
  headline: string;
}

/** The first non-empty value among several config aliases. */
function firstOf(config: Record<string, string>, ...keys: string[]): string {
  for (const key of keys) {
    const value = config[key]?.trim();
    if (value) return value;
  }
  return "";
}

const icpOf = (c: Record<string, string>) =>
  firstOf(c, "icp", "audience", "customer", "targetAudience", "businessContext");

const siteOf = (c: Record<string, string>) => firstOf(c, "websiteUrl", "siteUrl", "url");

const brandOf = (c: Record<string, string>) =>
  firstOf(c, "companyName", "brand", "businessName") || siteOf(c);

/**
 * A query, or nothing at all when the part that carries meaning is missing.
 *
 * Concatenating a suffix onto an empty seed is how a founder with no customer
 * profile ends up paying for a search for "news this week" — long enough to
 * pass a length check, and generic enough to be worthless. The seed is the
 * whole point of the query, so no seed means no search.
 */
function seeded(seed: string, ...rest: string[]): string {
  const core = seed.trim();
  if (core.length < 3) return "";
  return [core, ...rest].filter(Boolean).join(" ").trim();
}

/**
 * The table. One entry per agent that is genuinely better for having looked.
 *
 * Agents deliberately absent: the ones whose subject is the founder's own
 * material rather than the world — the repurposer works from a piece that
 * already exists, the changelog from what shipped, the inbox from a message
 * already received. Sending those a web search would spend money to add noise.
 */
const BRIEFS: Record<string, Brief> = {
  "research-agent": {
    capability: "research",
    query: (c) => seeded(icpOf(c), "news this week"),
    limit: 8,
    headline: "What the web is saying about your market right now",
  },
  "seo-agent": {
    capability: "serp",
    query: (c) => seeded(firstOf(c, "keywords", "targetKeywords") || icpOf(c)),
    limit: 10,
    headline:
      "What actually ranks for your keyword right now. Judge your page against " +
      "THESE pages, not against best practice in the abstract",
  },
  "blog-agent": {
    capability: "research",
    query: (c) => seeded(icpOf(c), "guide"),
    limit: 8,
    headline: "What already exists on this topic — say something these do not",
  },
  "content-agent": {
    capability: "social",
    query: (c) => seeded(icpOf(c)),
    limit: 10,
    headline: "What your market is posting about this week",
  },
  "newsletter-agent": {
    capability: "research",
    query: (c) => seeded(icpOf(c), "news"),
    limit: 8,
    headline: "This week's news, for the issue",
  },
  "competitor-agent": {
    capability: "company",
    query: (c) => seeded(firstOf(c, "competitors", "competitorUrl", "watchList").split(/[\n,]/)[0] ?? ""),
    limit: 5,
    headline: "What your competitor looks like right now",
  },
  "community-agent": {
    capability: "social",
    query: (c) => seeded(icpOf(c)),
    limit: 12,
    headline: "Live posts from where your customers actually talk",
  },
  "feedback-agent": {
    capability: "social",
    query: (c) => seeded(brandOf(c), "feedback"),
    limit: 10,
    headline: "What people are saying, unfiltered",
  },
  "review-agent": {
    capability: "reviews",
    query: (c) => seeded(brandOf(c)),
    limit: 10,
    headline: "Your live reviews",
  },
  "ads-agent": {
    capability: "social",
    query: (c) => seeded(icpOf(c), "ads"),
    limit: 10,
    headline: "What is being said in this market — for angles, not to copy",
  },
  "video-script-agent": {
    capability: "social",
    query: (c) => seeded(icpOf(c)),
    limit: 10,
    headline: "What is getting attention in this market right now",
  },
  "hiring-agent": {
    capability: "jobs",
    query: (c) => seeded(brandOf(c), firstOf(c, "role", "jobTitle") || "marketing", "jobs"),
    limit: 8,
    headline: "Comparable roles being advertised now",
  },
  "analytics-agent": {
    capability: "serp",
    query: (c) => seeded(firstOf(c, "keywords", "targetKeywords") || icpOf(c)),
    limit: 10,
    headline: "Where you sit in search, as a reference point",
  },
  "meeting-agent": {
    capability: "company",
    query: (c) => seeded(firstOf(c, "meetingWith", "company") || brandOf(c)),
    limit: 5,
    headline: "Who you are meeting",
  },
};

export interface Intel {
  /** The block to append to the agent's prompt, or "" when there is none. */
  text: string;
  used: boolean;
  /** What this cost, so the founder's ledger can record it. */
  cost: number;
  /** Which provider served it, for the audit trail. */
  via: string | null;
}

const NOTHING: Intel = { text: "", used: false, cost: 0, via: null };

/** Whether this agent has anything to look up at all. */
export function hasBrief(templateId: string): boolean {
  return templateId in BRIEFS;
}

/**
 * Go and look, on this agent's behalf.
 *
 * Never throws: an agent whose research failed still has a job to do, and a
 * failed lookup should cost it a paragraph of context rather than the run. A
 * failure is reported into the prompt rather than hidden, so the agent can say
 * "I could not see X" instead of writing confidently around the gap.
 */
export async function gatherIntel(
  monidKey: string,
  templateId: string,
  config: Record<string, string>,
): Promise<Intel> {
  const brief = BRIEFS[templateId];
  if (!brief) return NOTHING;

  const query = brief.query(config).trim();
  if (!query || query.length < 3) return NOTHING;

  const params: CapabilityParams = { query, limit: brief.limit ?? 8 };

  try {
    const result = await runCapability(monidKey, brief.capability, params);

    if (!result.ok || !result.rows.length) {
      return {
        ...NOTHING,
        cost: result.cost,
        via: result.via,
        text:
          `\n\nYou tried to look up ${brief.headline.toLowerCase()} and got nothing ` +
          `back${result.reason ? ` (${result.reason})` : ""}. Say so plainly if it ` +
          `matters to the answer — do not write as though you had seen it.`,
      };
    }

    return {
      used: true,
      cost: result.cost,
      via: result.via,
      text:
        `\n\n${brief.headline.toUpperCase()} — pulled minutes ago via ${result.via}. ` +
        `Write from THIS, and name the real things in it. Field names come from ` +
        `the source and vary, so read what is there rather than expecting a ` +
        `particular shape:\n${rowsBlock(result.rows)}`,
    };
  } catch {
    return NOTHING;
  }
}
