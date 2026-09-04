import "server-only";
import { createAdminClient } from "./supabase/admin";
import { runCapability, rowsBlock } from "./monid-capabilities";
import { platformMonidKey, platformFirecrawlKey } from "./platform-keys";
import { scrape, search } from "./firecrawl";
import { toLead, dedupeKey } from "./pipeline";

type Admin = ReturnType<typeof createAdminClient>;

/**
 * Doing what the founder asked, instead of writing about it.
 *
 * "Find me 10 leads" used to return three paragraphs about lead generation. Not
 * because the prompt was weak — because the chat path had no way to act. It was
 * a text completion with a web search bolted to a keyword regex, so the model's
 * only available move was to describe the thing it could not do. Every
 * complaint about the agents being useless traces back to that one gap.
 *
 * The obvious fix is native tool-calling, and it is the wrong one here. These
 * agents run on free models, where function-calling support is uneven and a
 * malformed tool call fails silently as prose — which is exactly the failure we
 * are trying to remove, reintroduced one layer down. So intent is detected
 * deterministically and the capability is executed by code. The model never
 * decides *whether* work happens; it only writes up work that already did.
 *
 * That inversion is the whole design. A model asked to "find leads and report"
 * can hallucinate the finding. A model handed twelve real rows and asked to
 * present them cannot.
 */

export type ActionKind = "leads" | "research" | "rankings" | "reviews" | "competitor" | "social";

export interface Action {
  kind: ActionKind;
  /** What to search for. Already cleaned of the command words. */
  query: string;
  /** How many results, when the founder named a number. */
  count?: number;
}

/** Numbers written as words, because founders type "find me ten leads". */
const WORD_NUMBERS: Record<string, number> = {
  five: 5, ten: 10, fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50,
};

function countIn(text: string): number | undefined {
  const digits = /\b(\d{1,3})\b/.exec(text);
  if (digits) return Math.min(Math.max(Number(digits[1]), 1), 50);

  for (const [word, value] of Object.entries(WORD_NUMBERS)) {
    if (new RegExp(`\\b${word}\\b`, "i").test(text)) return value;
  }
  return undefined;
}

/**
 * What the founder is actually asking for.
 *
 * Ordered by how specific the signal is. "Leads" is checked before the generic
 * research match because "find me leads in Dubai" contains "find" and would
 * otherwise be answered with a web search — technically a lookup, and useless.
 *
 * Returns null for ordinary conversation, which is most messages. A router that
 * fires on everything turns "thanks" into a paid API call.
 */
export function detectAction(text: string): Action | null {
  const t = text.trim();
  const lower = t.toLowerCase();

  // A request to WRITE something is never a lookup, however many lookup words
  // it contains. "Write me a blog post about pricing" contains "post about"
  // and was being answered with a paid social search — the founder gets a
  // bill and no blog post. Writing is the agent's own job; checked first, and
  // it wins outright.
  if (
    /\b(write|draft|compose|rewrite|edit|create|make|generate)\b/i.test(lower) &&
    /\b(post|blog|article|email|thread|script|copy|caption|newsletter|page|ad|headline)\b/i.test(
      lower,
    )
  ) {
    return null;
  }

  const strip = (patterns: RegExp[]): string => {
    let out = t;
    for (const p of patterns) out = out.replace(p, " ");
    return (
      out
        // Contractions leave orphaned fragments — "what's" strips to "'s",
        // which then ends up in the search term the provider is paid to run.
        // No leading \b: an apostrophe is not a word character, so a boundary
        // before it never matches.
        .replace(/['’]s\b/gi, " ")
        // Punctuation goes, except a dot between word characters — that is a
        // domain, and "dentally.co" searched as "dentally co" finds nothing.
        .replace(/(?<![A-Za-z0-9])[,;:.!?]+|[,;:.!?]+(?![A-Za-z0-9])/g, " ")
        .replace(/\s{2,}/g, " ")
        .trim()
        // Leading and trailing connectives left behind by the strip.
        .replace(/^(?:in|on|for|about|of|to|the|a|an)\s+/i, "")
        .replace(/\s+(?:in|on|for|about|of|to|the|a|an)$/i, "")
        .trim()
    );
  };

  // Leads. The one the founder asks for most and the one that failed loudest.
  if (/\b(leads?|prospects?|contacts?|people to (email|contact)|icp list)\b/i.test(lower)) {
    return {
      kind: "leads",
      count: countIn(lower) ?? 10,
      query: strip([
        /\b(find|get|pull|fetch|give|show|me|some|please|now|new)\b/gi,
        /\b\d{1,3}\b/g,
        new RegExp(`\\b(${Object.keys(WORD_NUMBERS).join("|")})\\b`, "gi"),
        /\b(leads?|prospects?|contacts?)\b/gi,
      ]),
    };
  }

  // Rankings — asked as "where do I rank", "check my SEO for X".
  if (/\b(rank|ranking|rankings|serp|position|seo (for|on|check)|who ranks)\b/i.test(lower)) {
    return {
      kind: "rankings",
      query: strip([/\b(check|what|where|do|i|my|we|our|rank|ranking|rankings|for|on|seo|serp|position)\b/gi]),
    };
  }

  if (/\b(reviews?|ratings?|what are people saying about)\b/i.test(lower)) {
    return {
      kind: "reviews",
      query: strip([/\b(check|show|find|me|our|my|the|reviews?|ratings?|for|about|what|are|people|saying)\b/gi]),
    };
  }

  if (/\b(competitor|competition|rival|versus|compare (us|me) (to|with))\b/i.test(lower)) {
    return {
      kind: "competitor",
      query: strip([/\b(check|look|at|our|my|the|competitors?|competition|rivals?|analy[sz]e|compare|us|to|with)\b/gi]),
    };
  }

  if (/\b(on (x|twitter|reddit|linkedin)|social|posts? about|what.s trending)\b/i.test(lower)) {
    return {
      kind: "social",
      query: strip([/\b(check|show|find|me|what|whats|is|are|trending|on|x|twitter|reddit|linkedin|social|posts?|about)\b/gi]),
    };
  }

  // Research last: the broadest match, so anything more specific wins first.
  if (/\b(research|look up|find out|latest|news|what.s (new|happening)|market|trends?)\b/i.test(lower)) {
    return {
      kind: "research",
      query: strip([/\b(do|some|research|on|about|look|up|find|out|the|latest|news|whats|what.s|new|happening|in|for|me|please)\b/gi]),
    };
  }

  return null;
}

export interface ActionResult {
  /** A block of real findings for the model to write up. Empty when nothing. */
  evidence: string;
  /** A one-line note for the founder when it could not be done. */
  problem: string | null;
  /** How many real rows came back. */
  rows: number;
  /** What it cost, for the ledger. */
  cost: number;
}

/**
 * Run the action for real, on the platform's keys.
 *
 * The founder configures nothing. Every key here belongs to the platform, so a
 * founder who signed up ninety seconds ago has the same working agents as one
 * who has been here a month — which is the difference between a product and a
 * kit.
 *
 * Leads are written into the pipeline as well as returned, so "find me ten
 * leads" in chat feeds the same queue the outreach squad works from. Asking for
 * something and having it silently not persist is its own kind of lie.
 */
export async function runAction(
  admin: Admin,
  userId: string,
  action: Action,
  context: { icp: string; website: string; company: string; competitors: string },
): Promise<ActionResult> {
  const monid = platformMonidKey();
  const firecrawl = platformFirecrawlKey();

  // Fall back to what the founder's profile already says when they did not
  // spell it out. "Find me 10 leads" with no qualifier means their own ICP.
  const query =
    action.query.length > 2
      ? action.query
      : action.kind === "leads" || action.kind === "research" || action.kind === "social"
        ? context.icp
        : action.kind === "competitor"
          ? context.competitors.split(/[\n,]/)[0] ?? ""
          : context.company || context.website;

  if (!query.trim()) {
    return {
      evidence: "",
      rows: 0,
      cost: 0,
      problem:
        "I do not know enough about your business yet to search for that. Tell me who your customer is and I will go and look.",
    };
  }

  if (action.kind === "research") {
    if (!firecrawl) {
      return { evidence: "", rows: 0, cost: 0, problem: "Web research is not switched on right now." };
    }
    const hits = await search(`${query} — latest, this week`, 8, firecrawl).catch(() => []);
    if (!hits.length) {
      return { evidence: "", rows: 0, cost: 0, problem: `I searched for "${query}" and got nothing back.` };
    }
    return {
      rows: hits.length,
      cost: 0,
      problem: null,
      evidence:
        `REAL SEARCH RESULTS for "${query}", pulled seconds ago:\n` +
        hits.map((h) => `- ${h.title}: ${h.description} (${h.url})`).join("\n"),
    };
  }

  if (!monid) {
    return { evidence: "", rows: 0, cost: 0, problem: "That lookup is not switched on right now." };
  }

  const capability = (
    {
      leads: "leads",
      rankings: "serp",
      reviews: "reviews",
      competitor: "company",
      social: "social",
    } as const
  )[action.kind];

  const result = await runCapability(monid, capability, {
    query,
    limit: action.count ?? 10,
  });

  if (!result.ok || !result.rows.length) {
    return {
      evidence: "",
      rows: 0,
      cost: result.cost,
      problem: result.reason ?? `I looked for "${query}" and nothing came back.`,
    };
  }

  // Leads go into the pipeline too, so chat and the squads share one queue.
  if (action.kind === "leads") {
    const rows: Record<string, unknown>[] = [];
    for (const raw of result.rows) {
      const lead = toLead(raw);
      const key = dedupeKey(lead);
      // No identity, no row. A lead nothing can match arrives again tomorrow.
      if (!key) continue;
      rows.push({
        ...lead,
        user_id: userId,
        stage: "found",
        dedupe_key: key,
        source: result.via,
        cost: 0,
      });
    }

    if (rows.length) {
      await admin
        .from("leads")
        .upsert(rows, { onConflict: "user_id,dedupe_key", ignoreDuplicates: true })
        .then(() => undefined, () => undefined);
    }
  }

  return {
    rows: result.rows.length,
    cost: result.cost,
    problem: null,
    evidence:
      `REAL RESULTS you just pulled via ${result.via} for "${query}". These are ` +
      `the only ones that exist — never add to this list, never invent a name, ` +
      `an address or a number:\n${rowsBlock(result.rows, action.count ?? 12)}`,
  };
}

/**
 * How the agent must present findings it actually has.
 *
 * Blunt about format because the failure being corrected is verbosity. A
 * founder who asked for ten leads wants ten lines, not an essay explaining what
 * a lead is — and a model that has just been handed real data is, oddly, more
 * prone to padding than one that has none, because it now has something to
 * introduce.
 */
export function presentationRules(action: Action, result: ActionResult): string {
  if (result.problem) {
    return (
      `\n\nYou tried to do this and it did not work: ${result.problem}\n` +
      `Say exactly that, in one line, plainly. Do not apologise at length, do ` +
      `not explain how you would normally do it, and do NOT make up a result.`
    );
  }

  const shape =
    action.kind === "leads"
      ? "One line per person: name — title at company — email if there is one. " +
        "No introduction, no closing paragraph, no advice about outreach."
      : action.kind === "rankings"
        ? "One line per result: position, page, and one clause on why it ranks."
        : "One line per item, the specific fact first.";

  return (
    `\n\nYou have just done this work and the real results are above. Report ` +
    `them and nothing else.\n${shape}\n` +
    `Start with a single short line saying what you found and how many. Then ` +
    `the list. Then stop — no summary, no next steps unless asked.`
  );
}
