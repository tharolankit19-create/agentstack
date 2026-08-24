import "server-only";
import { createAdminClient } from "./supabase/admin";
import { loadConnectors, houseFirecrawlKey, houseXKey } from "./connectors";
import { scrape, search } from "./firecrawl";
import { searchX } from "./xquik";

/**
 * Live research the agents can pull mid-conversation.
 *
 * The founder's whole ask is that an agent does not answer from a frozen 2024
 * memory — when they say "write me a post", it should go and look: what is
 * trending in their niche this week, what a competitor just changed, what people
 * are saying on X right now, and write from that. This module is the "go and
 * look" part, shared by the chat path and the research cron so both see the
 * world the same way.
 *
 * It runs on the founder's own keys (their Firecrawl and X, from the connectors
 * page) and falls back to the platform's. No key, no research — it returns
 * empty and the caller answers from what it already knows, rather than failing.
 */

type Admin = ReturnType<typeof createAdminClient>;

/**
 * Whether a message is worth researching before answering.
 *
 * Writing anything, or asking about trends, competitors, news or "what's
 * happening" — those get live signal. "Approve", "thanks", "what time is the
 * briefing" do not. Kept broad on purpose: a false positive costs a few seconds
 * of lookup, a false negative costs the founder a generic answer.
 */
export function wantsResearch(text: string): boolean {
  // A pasted link is a research request on its own. The founder saying
  // "look at competitor.com" contains no keyword at all, and the agent used to
  // answer it from memory and then claim it had no web access.
  if (extractUrls(text).length > 0) return true;

  const t = ` ${text.toLowerCase()} `;
  return /(post|tweet|thread|write|writ|draft|content|caption|blog|newsletter|idea|angle|hook|headline|trend|trending|latest|recent|news|competitor|rival|market|niche|research|analy|opportunit|what.?s happening|likh|banao|banade|dhoond|khoj|naya|nayi|new)/.test(
    t,
  );
}

export interface LiveResearch {
  /** A compact, model-ready block of findings, or "" when nothing was found. */
  text: string;
  /** Whether any real signal was gathered. */
  used: boolean;
  /** Whether the founder even has a research source connected. */
  hasSource: boolean;
}

/**
 * The links in a message, normalised.
 *
 * Deliberately generous: founders paste "competitor.com" as often as a full
 * https URL, and refusing the former is how an agent ends up insisting it
 * cannot browse a page it was handed.
 */
export function extractUrls(text: string): string[] {
  const found = new Set<string>();

  for (const raw of text.match(/https?:\/\/[^\s<>()"']+/gi) ?? []) {
    found.add(raw.replace(/[.,;:)\]]+$/, ""));
  }

  // Bare domains — "competitor.com/pricing" — but not emails or version numbers.
  for (const raw of text.match(/\b(?!\d+\.\d+)[a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)*\.[a-z]{2,}(?:\/[^\s<>()"']*)?/gi) ?? []) {
    if (raw.includes("@")) continue;
    if (/^https?:/i.test(raw)) continue;
    if (text.includes(`@${raw}`)) continue;
    found.add(`https://${raw.replace(/[.,;:)\]]+$/, "")}`);
  }

  return [...found].slice(0, 3);
}

interface Ctx {
  icp: string;
  website: string;
  competitors: string[];
}

/** Pull the business context out of an agent's config, alias-tolerant. */
function contextFrom(config: Record<string, string>): Ctx {
  const icp = config.icp || config.audience || config.customer || config.targetAudience || "";
  const website = config.websiteUrl || config.siteUrl || config.url || "";
  const competitors = String(config.competitors || config.competitorUrls || config.watchList || "")
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
  return { icp, website, competitors };
}

/**
 * Go and look, for one topic, on this founder's behalf.
 *
 * Bounded so a founder waiting on Telegram is not left hanging: one web search,
 * one competitor page, one X pass — enough to ground an answer in this week
 * without turning a reply into a crawl.
 */
export async function gatherLiveResearch(
  admin: Admin,
  userId: string,
  config: Record<string, string>,
  topic: string,
): Promise<LiveResearch> {
  const connectors = await loadConnectors(admin, userId);
  const firecrawlKey = connectors.firecrawl ?? (await houseFirecrawlKey(admin));
  if (!firecrawlKey) return { text: "", used: false, hasSource: false };
  const xKey = connectors.x ?? (await houseXKey(admin));

  const { icp, website, competitors } = contextFrom(config);
  const blocks: string[] = [];

  // 0. Anything the founder actually pasted, read first and read properly.
  //
  // This is the case that made agents look like liars: handed a competitor's
  // URL and asked to look at it, the agent searched the founder's niche
  // instead, found nothing about that page, and replied that it had no web
  // access. If there is a link in the message, that link is the assignment.
  const pasted = extractUrls(topic);
  for (const url of pasted) {
    const md = await scrape(url, 4000, firecrawlKey);
    if (md) {
      blocks.push(`You just read ${url}. Here is what is actually on it:\n${md.slice(0, 3000)}`);
    } else {
      blocks.push(
        `You tried to read ${url} and the page could not be fetched (it may be ` +
          `blocked or down). Say that plainly — do not claim you cannot browse.`,
      );
    }
  }

  // 1. What's trending in their niche, around what they asked.
  const query = [icp, topic].filter(Boolean).join(" — ") || website || topic;
  const hits = pasted.length > 0
    ? []
    : await search(`${query} — latest trends and discussion this week`, 5, firecrawlKey);
  if (hits.length > 0) {
    blocks.push(
      "Fresh from the web this week:\n" +
        hits.map((h) => `- ${h.title}: ${h.description} (${h.url})`).join("\n"),
    );
  }

  // 2. What a competitor is saying right now.
  if (competitors[0] && pasted.length === 0) {
    const md = await scrape(competitors[0], 2000, firecrawlKey);
    if (md) blocks.push(`What ${competitors[0]} is currently saying:\n${md.slice(0, 1400)}`);
  }

  // 3. What people are saying on X.
  if (xKey) {
    const xh = await searchX(icp || topic || website, 6, xKey);
    if (xh.length > 0) {
      blocks.push(
        "Live on X right now:\n" +
          xh.map((x) => `- @${x.author}: ${x.text.slice(0, 160)}`).join("\n"),
      );
    }
  }

  if (blocks.length === 0) return { text: "", used: false, hasSource: true };
  return { text: blocks.join("\n\n"), used: true, hasSource: true };
}
