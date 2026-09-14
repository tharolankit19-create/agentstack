import { platformMonidKey } from "./platform-keys";
import { runCapability, rowsBlock } from "./monid-capabilities";
import "server-only";
import { createAdminClient } from "./supabase/admin";
import { loadConnectors, houseFirecrawlKey, houseXKey, houseMonidKey } from "./connectors";
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

export interface ResearchOptions {
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
  const [firecrawlKey,monidKey,xKey] = await Promise.all([
    connectors.firecrawl ?? houseFirecrawlKey(admin),
    connectors.monid ?? platformMonidKey() ?? houseMonidKey(admin),
    connectors.x ?? houseXKey(admin),
  ]);
  if (!firecrawlKey && !monidKey && !xKey) return {text:"",used:false,hasSource:false};
  const {icp,website,competitors}=contextFrom(config);
  const blocks:string[]=[], notes:string[]=[];
  const pasted=extractUrls(topic);
  const targets=[...pasted,...(options.ownSite && website ? [website] : []),
    ...(pasted.length?[]:competitors.slice(0,Math.max(0,Math.min(options.competitorDepth??1,3))))];
  // Exact page reads stay separate from search results. A search snippet is not
  // proof that we fetched a page, and a fetch failure is never research evidence.
  if(firecrawlKey) await Promise.all([...new Set(targets)].slice(0,4).map(async url=>{
    const md=await scrape(url,4000,firecrawlKey).catch(()=>null);
    if(md) blocks.push("Fetched page: "+url+"\n"+md.slice(0,3500));
    else notes.push("Could not fetch "+url+". Do not invent its contents.");
  }));
  else if(targets.length) notes.push("Exact page reads are unavailable. Search results below are not a page audit.");
  const query=[icp,topic].filter(Boolean).join(" — ").slice(0,1000) || website;
  let found=false;
  if(monidKey && query) {
    const capability=/review|complaint|rating/i.test(topic)?"reviews":/social|reddit|twitter|linkedin|tweet/i.test(topic)?"social":/hiring|job posting/i.test(topic)?"jobs":"research";
    const result=await runCapability(monidKey,capability,{query,limit:5},18_000);
    const rows=result.rows.filter(row=>Object.values(row).some(v=>typeof v==="string"&&v.trim().length>20));
    if(result.ok && rows.length) {
      blocks.push("Monid "+capability+" results via "+(result.via??"catalogue")+" (retrieved "+new Date().toISOString()+"):\n"+rowsBlock(rows,5));
      found=true;
    }
  }
  if(!found && firecrawlKey && !pasted.length) {
    const hits=await search(query,5,firecrawlKey).catch(()=>[]);
    if(hits.length) blocks.push("Web search results (check publication dates):\n"+hits.map(h=>"- "+h.title+": "+h.description+" ("+h.url+")").join("\n"));
  }
  if(xKey && !found) {
    const hits=await searchX(icp||topic||website,5,xKey).catch(()=>[]);
    if(hits.length) blocks.push("X search results:\n"+hits.map(x=>"- @"+x.author+": "+x.text.slice(0,240)).join("\n"));
  }
  return {text:[...blocks,...notes].join("\n\n"),used:blocks.length>0,hasSource:true};
}
