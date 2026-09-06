import "server-only";
import { createAdminClient } from "./supabase/admin";
import { loadConnectors, houseFirecrawlKey, houseXKey } from "./connectors";
import { scrape, search } from "./firecrawl";
import { searchX } from "./xquik";
import type { Reporter } from "./work-report";

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

export interface ResearchOptions {
  report?: Reporter;
  /**
   * Read the founder's own site before anything else.
   *
   * Off by default because most work does not need it, and on for the agents
   * whose entire job is the founder's own pages. An SEO agent that has never
   * loaded the page it is auditing can only produce generic advice — which is
   * exactly what it was producing: it received "what is trending in your niche"
   * and a competitor's homepage, and was then asked to name the exact title tag
   * to write on a page it had never seen.
   */
  ownSite?: boolean;
  /**
   * How many competitor pages to read. One is right for a chat reply the
   * founder is waiting on; the competitor agent running on a cron has minutes,
   * and "what changed across the field" needs more than one field.
   */
  competitorDepth?: number;
}

/**
 * Go and look, for one topic, on this founder's behalf.
 *
 * Bounded by default so a founder waiting on Telegram is not left hanging: one
 * web search, one competitor page, one X pass — enough to ground an answer in
 * this week without turning a reply into a crawl. Callers with a longer budget
 * (the crons, which have minutes) ask for more through `options`.
 */
export async function gatherLiveResearch(
  admin: Admin,
  userId: string,
  config: Record<string, string>,
  topic: string,
  options: ResearchOptions = {},
): Promise<LiveResearch> {
  const connectors = await loadConnectors(admin, userId);
  const firecrawlKey = connectors.firecrawl ?? (await houseFirecrawlKey(admin));
  if (!firecrawlKey) return { text: "", used: false, hasSource: false };
  const xKey = connectors.x ?? (await houseXKey(admin));

  const { icp, website, competitors } = contextFrom(config);
  const blocks: string[] = [];
  let sourceCount = 0;
  const report = options.report ?? (async () => {});

  // 0. Anything the founder actually pasted, read first and read properly.
  //
  // This is the case that made agents look like liars: handed a competitor's
  // URL and asked to look at it, the agent searched the founder's niche
  // instead, found nothing about that page, and replied that it had no web
  // access. If there is a link in the message, that link is the assignment.
  const pasted = extractUrls(topic);
  for (const url of pasted) {
    await report(`Fetching ${url}`);
    const md = await scrape(url, 4000, firecrawlKey);
    await report(md ? `Fetched ${url} · ${md.length} characters read` : `Could not fetch ${url}`);
    if (md) {
      sourceCount++;
      blocks.push(`You just read ${url}. Here is what is actually on it:\n${md.slice(0, 3000)}`);
    } else {
      blocks.push(
        `You tried to read ${url} and the page could not be fetched (it may be ` +
          `blocked or down). Say that plainly — do not claim you cannot browse.`,
      );
    }
  }

  // 1. The founder's own page, for the agents whose job is that page.
  //
  // Before the search, because when an SEO or landing agent has a limited
  // budget the site it is auditing is the one thing it cannot work without.
  if (options.ownSite && website && pasted.length === 0) {
    await report(`Fetching ${website}`);
    const own = await scrape(website, 6000, firecrawlKey);
    await report(own ? `Fetched ${website} · ${own.length} characters read` : `Could not fetch ${website}`);
    if (own) {
      sourceCount++;
      blocks.push(
        `THE PAGE YOU ARE WORKING ON — ${website}. This is what is actually on ` +
          `it right now. Every specific you give must come from this, not from ` +
          `a guess about what a page like this usually says:\n${own.slice(0, 5000)}`,
      );
    } else {
      blocks.push(
        `You tried to read ${website} and it could not be fetched. Say so ` +
          `plainly and do not invent what is on the page.`,
      );
    }
  }

  // 2. What's trending in their niche, around what they asked.
  const query = [icp, topic].filter(Boolean).join(" — ") || website || topic;
  if (!pasted.length) await report(`Searching the web: ${query.slice(0, 240)}`);
  const hits = pasted.length > 0
    ? []
    : await search(`${query} — latest trends and discussion this week`, 5, firecrawlKey);
  if (hits.length > 0) {
    sourceCount += hits.length;
    await report(`Found ${hits.length} search results:\n${hits.map(h => h.url).join("\n")}`);
    blocks.push(
      "Fresh from the web this week:\n" +
        hits.map((h) => `- ${h.title}: ${h.description} (${h.url})`).join("\n"),
    );
  }

  // 3. What the competitors are saying right now.
  const depth = Math.max(1, Math.min(options.competitorDepth ?? 1, 3));
  if (pasted.length === 0) {
    for (const rival of competitors.slice(0, depth)) {
      await report(`Fetching competitor ${rival}`);
      const md = await scrape(rival, 2000, firecrawlKey);
      await report(md ? `Fetched competitor ${rival}` : `Could not fetch competitor ${rival}`);
      if (md) { sourceCount++; blocks.push(`What ${rival} is currently saying:\n${md.slice(0, 1400)}`); }
    }
  }

  // 4. What people are saying on X.
  if (xKey) {
    const xh = await searchX(icp || topic || website, 6, xKey);
    if (xh.length > 0) {
      sourceCount += xh.length;
      blocks.push(
        "Live on X right now:\n" +
          xh.map((x) => `- @${x.author}: ${x.text.slice(0, 160)}`).join("\n"),
      );
    }
  }

  if (blocks.length === 0) return { text: "", used: false, hasSource: true };
  return { text: blocks.join("\n\n"), used: sourceCount > 0, hasSource: true };
}
