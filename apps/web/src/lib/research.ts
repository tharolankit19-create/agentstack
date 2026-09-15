import "server-only";
import { createAdminClient } from "./supabase/admin";
import { rowsBlock, type CapabilityId } from "./monid-capabilities";
import { runMeteredCapability } from "./monid-metered";
import {
  loadConnectors,
  houseFirecrawlKey,
  houseXKey,
  houseMonidKeys,
} from "./connectors";
import { scrape, search } from "./firecrawl";
import { searchX } from "./xquik";
import { canAfford, spend, COST, type Metered } from "./credits";

type Admin = ReturnType<typeof createAdminClient>;

export function wantsResearch(text: string): boolean {
  if (extractUrls(text).length > 0) return true;
  const t = ` ${text.toLowerCase()} `;
  return /(post|tweet|thread|write|writ|draft|content|caption|blog|newsletter|idea|angle|hook|headline|trend|trending|latest|recent|news|competitor|rival|market|niche|research|analy|opportunit|what.?s happening|likh|banao|banade|dhoond|khoj|naya|nayi|new)/.test(t);
}

export interface LiveResearch {
  text: string;
  used: boolean;
  hasSource: boolean;
  chargedCredits: number;
}

export function extractUrls(text: string): string[] {
  const found = new Set<string>();

  for (const raw of text.match(/https?:\/\/[^\s<>()"']+/gi) ?? []) {
    found.add(raw.replace(/[.,;:)\]]+$/, ""));
  }

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

function contextFrom(config: Record<string, string>): Ctx {
  const icp = config.icp || config.audience || config.customer || config.targetAudience || "";
  const website = config.websiteUrl || config.siteUrl || config.url || "";
  const competitors = String(config.competitors || config.competitorUrls || config.watchList || "")
    .split(/[\n,]/)
    .map((value) => value.trim())
    .filter(Boolean);
  return { icp, website, competitors };
}

export interface ResearchOptions {
  ownSite?: boolean;
  competitorDepth?: number;
  /** When agent-intel already did a Monid lookup, avoid paying for another. */
  skipMonid?: boolean;
  /** Hard per-gather customer-credit ceiling. */
  maxCredits?: number;
  agentId?: string;
}

function topicCapability(topic: string): CapabilityId {
  if (/review|complaint|rating/i.test(topic)) return "reviews";
  if (/social|reddit|twitter|linkedin|tweet/i.test(topic)) return "social";
  if (/hiring|job posting/i.test(topic)) return "jobs";
  return "research";
}

export async function gatherLiveResearch(
  admin: Admin,
  userId: string,
  config: Record<string, string>,
  topic: string,
  options: ResearchOptions = {},
): Promise<LiveResearch> {
  const connectors = await loadConnectors(admin, userId);
  const [firecrawlKey, platformMonidKeys, xKey] = await Promise.all([
    connectors.firecrawl ?? houseFirecrawlKey(admin),
    houseMonidKeys(admin),
    connectors.x ?? houseXKey(admin),
  ]);
  const monidKeys = connectors.monid ? [connectors.monid] : platformMonidKeys;
  const hasSource = Boolean(firecrawlKey || monidKeys.length || xKey);
  if (!hasSource) return { text: "", used: false, hasSource: false, chargedCredits: 0 };

  const maxCredits = Math.max(0, options.maxCredits ?? 20);
  let chargedCredits = 0;
  const canSpendLocally = (action: Metered) =>
    chargedCredits + COST[action] <= maxCredits;

  const chargeSuccess = async (action: Metered, agentId?: string): Promise<boolean> => {
    if (!canSpendLocally(action)) return false;
    if (!(await canAfford(admin, userId, action))) return false;
    const result = await spend(admin, userId, action, agentId);
    if (!result.ok) return false;
    chargedCredits += COST[action];
    return true;
  };

  const { icp, website, competitors } = contextFrom(config);
  const blocks: string[] = [];
  const notes: string[] = [];
  const pasted = extractUrls(topic);
  const targets = [
    ...pasted,
    ...(options.ownSite && website ? [website] : []),
    ...(pasted.length
      ? []
      : competitors.slice(
          0,
          Math.max(0, Math.min(options.competitorDepth ?? 1, 3)),
        )),
  ];

  for (const url of [...new Set(targets)].slice(0, 4)) {
    if (!canSpendLocally("page_read")) break;

    if (firecrawlKey && (await canAfford(admin, userId, "page_read"))) {
      const markdown = await scrape(url, 4000, firecrawlKey).catch(() => null);
      if (markdown && (await chargeSuccess("page_read", options.agentId))) {
        blocks.push(`Fetched page: ${url}\n${markdown.slice(0, 3500)}`);
        continue;
      }
    }

    if (monidKeys.length) {
      const result = await runMeteredCapability(
        admin,
        userId,
        monidKeys,
        "page",
        { query: url, limit: 1 },
        { budgetMs: 18_000, agentId: options.agentId },
      );
      if (result.ok && result.rows.length) {
        chargedCredits += result.chargedCredits;
        blocks.push(
          `Fetched page via ${result.via ?? "Monid"}: ${url}\n${rowsBlock(result.rows, 1)}`,
        );
        continue;
      }
    }

    notes.push(`Could not fetch ${url}. Do not invent its contents.`);
  }

  const query = [icp, topic].filter(Boolean).join(" — ").slice(0, 1000) || website;
  let found = false;

  if (!options.skipMonid && monidKeys.length && query) {
    const capability = topicCapability(topic);
    const actionCost =
      capability === "social"
        ? COST.social_scan
        : capability === "reviews"
          ? COST.review_check
          : COST.web_search;

    if (chargedCredits + actionCost <= maxCredits) {
      const result = await runMeteredCapability(
        admin,
        userId,
        monidKeys,
        capability,
        { query, limit: 5 },
        { budgetMs: 18_000, agentId: options.agentId },
      );
      const rows = result.rows.filter((row) =>
        Object.values(row).some(
          (value) => typeof value === "string" && value.trim().length > 20,
        ),
      );
      if (result.ok && rows.length) {
        chargedCredits += result.chargedCredits;
        blocks.push(
          `Monid ${capability} results via ${result.via ?? "catalogue"} (retrieved ${new Date().toISOString()}):\n${rowsBlock(rows, 5)}`,
        );
        found = true;
      }
    }
  }

  if (!found && firecrawlKey && !pasted.length && query && canSpendLocally("web_search")) {
    if (await canAfford(admin, userId, "web_search")) {
      const hits = await search(query, 5, firecrawlKey).catch(() => []);
      if (hits.length && (await chargeSuccess("web_search", options.agentId))) {
        blocks.push(
          "Web search results (check publication dates):\n" +
            hits
              .map((hit) => `- ${hit.title}: ${hit.description} (${hit.url})`)
              .join("\n"),
        );
        found = true;
      }
    }
  }

  if (xKey && !found && canSpendLocally("social_scan")) {
    if (await canAfford(admin, userId, "social_scan")) {
      const hits = await searchX(icp || topic || website, 5, xKey).catch(() => []);
      if (hits.length && (await chargeSuccess("social_scan", options.agentId))) {
        blocks.push(
          "X search results:\n" +
            hits
              .map((hit) => `- @${hit.author}: ${hit.text.slice(0, 240)}`)
              .join("\n"),
        );
      }
    }
  }

  return {
    text: [...blocks, ...notes].join("\n\n"),
    used: blocks.length > 0,
    hasSource,
    chargedCredits,
  };
}
