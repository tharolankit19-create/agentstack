import directoryJson from "@/data/directory.json";
import { TEMPLATES, type AgentTemplate } from "./templates";

/**
 * The honest answer to "can an agent replace this tool?"
 *
 * This file is the most important marketing asset in the product, and it is
 * built on saying **no** a lot. A directory that claims everything is
 * replaceable is an advertisement and gets read as one. A directory that tells
 * you which of your subscriptions to keep is a reference, and people send
 * references to their friends.
 *
 * Every "yes" here is backed by an agent that exists in the catalog. Every
 * "no" costs us a sale and buys the credibility that makes the rest work.
 */

export type Verdict = "yes" | "partial" | "no";

export interface Replaceable {
  /** URL slug: /replace/buffer */
  slug: string;
  /** The product name as people write it. */
  tool: string;
  /** Their own domain, used for the row icon. Absent on hand-written entries. */
  domain?: string;
  /** Editorial prominence, 1–5. Decides which logos go above the fold. */
  priority?: number;
  verdict: Verdict;
  /** Typical monthly list price, in USD. 0 when it varies too much to claim. */
  monthlyUsd: number;
  /** The job people actually hire it for, in one line. */
  job: string;
  /** Catalog agent that does that job. Null when the verdict is "no". */
  templateId: string | null;
  /** What the agent genuinely does. Concrete, not adjectives. */
  does: string[];
  /** What it does not do. This is the section people screenshot. */
  doesNot: string[];
  /** One paragraph a skeptic would accept. */
  honestTake: string;
}

/**
 * Tools we say no to.
 *
 * Three reasons a tool lands here: it is a system of record, being wrong is
 * expensive, or the product is infrastructure rather than work. None of those
 * are things a language model on a schedule should be near.
 */
const NOT_REPLACEABLE: Replaceable[] = [
  {
    slug: "stripe",
    tool: "Stripe",
    verdict: "no",
    monthlyUsd: 0,
    job: "Take money and remember who paid.",
    templateId: null,
    does: [],
    doesNot: [
      "Nothing. Do not put an agent between you and your revenue.",
    ],
    honestTake:
      "This is payment infrastructure and a system of record. An agent can read your Stripe data and tell you what moved — our Finance Agent does exactly that — but replacing Stripe itself is not a cost decision, it is a way to lose money you cannot get back.",
  },
  {
    slug: "supabase",
    tool: "Supabase",
    verdict: "no",
    monthlyUsd: 0,
    job: "Hold your data and authenticate your users.",
    templateId: null,
    does: [],
    doesNot: ["Nothing. This is where your data lives."],
    honestTake:
      "Databases and auth are infrastructure, not work. There is no job here for an agent to do. Anyone selling you an 'AI replacement' for your database is selling you an outage.",
  },
  {
    slug: "figma",
    tool: "Figma",
    verdict: "no",
    monthlyUsd: 0,
    job: "Design things, together, with a history.",
    templateId: null,
    does: [],
    doesNot: [
      "Design work with taste in it",
      "Anything where the file is the shared source of truth for a team",
    ],
    honestTake:
      "Design tools are a canvas, not a chore. The work being done in Figma is judgement, and judgement is exactly the category agents should stay out of. Keep paying for it.",
  },
  {
    slug: "quickbooks",
    tool: "QuickBooks / Xero",
    verdict: "no",
    monthlyUsd: 0,
    job: "Keep books that survive an audit.",
    templateId: null,
    does: [],
    doesNot: ["Anything an accountant or a tax authority will read"],
    honestTake:
      "Accounting is a place where being wrong is expensive and the wrongness surfaces months later. An agent can summarise your numbers for you on a Monday. It should not be the thing your filings are based on.",
  },
  {
    slug: "slack",
    tool: "Slack",
    verdict: "no",
    monthlyUsd: 0,
    job: "Be the place your team talks.",
    templateId: null,
    does: [],
    doesNot: ["Being a place. That is the whole product."],
    honestTake:
      "You cannot replace a room. Agents should post *into* Slack — several of ours do — but the room itself is not a subscription you can automate away.",
  },
];

/** Human-readable slug from a product name. */
export function toSlug(tool: string): string {
  return tool
    .toLowerCase()
    .replace(/\.[a-z]+$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Per-agent detail for the tools we do replace.
 *
 * Keyed by template id. The `doesNot` lines are deliberately specific — a
 * generic limitation reads as a disclaimer, a specific one reads as someone
 * who has actually used the thing.
 */
const DETAIL: Record<
  string,
  { verdict: Verdict; job: string; does: string[]; doesNot: string[]; honestTake: string }
> = {
  "content-agent": {
    verdict: "yes",
    job: "Post to social on a schedule so the account is not dead.",
    does: [
      "Reads your site before every run, so drafts describe the real product",
      "Writes 5 tweets and 2 LinkedIn posts each weekday",
      "Publishes to X and LinkedIn once you turn that on",
      "Keeps every draft in one place whether you post it or not",
    ],
    doesNot: [
      "Reply to comments or run conversations in your DMs",
      "Read a room — it will not know a launch went badly",
      "Post images, video, or anything visual",
    ],
    honestTake:
      "Scheduling tools never wrote your posts; they stored what you already wrote. The writing was always the job, and that is the part this does. You still choose what ships.",
  },
  "blog-agent": {
    verdict: "yes",
    job: "Turn a keyword into a publishable article.",
    does: [
      "Reads your site, picks one keyword, outlines, then writes the full piece",
      "Refuses to invent statistics or attribute claims to studies it cannot name",
      "Produces markdown you can paste straight into your CMS",
    ],
    doesNot: [
      "Original research, interviews, or anything requiring a source you own",
      "Know whether the topic is worth writing about for your business",
      "Publish for you",
    ],
    honestTake:
      "Good for the pages that exist so the question has an answer. Not a substitute for the two or three pieces a year that need your actual thinking.",
  },
  "newsletter-agent": {
    verdict: "yes",
    job: "Send a weekly email that is not empty.",
    does: [
      "Reads your changelog or site and finds the one thing worth telling people",
      "Writes subject and body in your tone",
      "Sends through Resend when you switch sending on",
    ],
    doesNot: [
      "Manage your list, segments, or unsubscribes",
      "Handle deliverability, warmup, or domain reputation",
      "Know that this week's news is actually bad news",
    ],
    honestTake:
      "This replaces the writing, not the sending infrastructure. If your newsletter tool is really your list and your deliverability, keep it and use this to fill it.",
  },
  "repurpose-agent": {
    verdict: "yes",
    job: "Turn one long piece into a week of short ones.",
    does: [
      "Reads a post and produces 5 tweets, a LinkedIn post, and a carousel outline",
      "Makes each piece stand alone rather than summarising",
    ],
    doesNot: ["Cut video or audio", "Design the carousel"],
    honestTake:
      "The text half of repurposing, done well. The video half is a genuinely different problem and we do not pretend otherwise.",
  },
  "video-script-agent": {
    verdict: "partial",
    job: "Write scripts and hooks for short video.",
    does: [
      "Writes a shootable script with the hook first and visual cues marked",
      "Keeps the cues cheap — screen recordings, not a crew",
    ],
    doesNot: ["Edit", "Caption", "Publish", "Appear on camera for you"],
    honestTake:
      "Partial on purpose. This replaces the blank page, not the edit bay. If your video tool is mostly an editor, you are keeping it.",
  },
  "lead-agent": {
    verdict: "yes",
    job: "Find people who match your ICP.",
    does: [
      "Turns a plain-English ICP into a real Apollo search",
      "Returns leads with title, company, size and email when available",
      "Writes a personalised opening line per lead",
    ],
    doesNot: [
      "Provide the data — you bring your own Apollo key, so you pay them directly",
      "Send anything",
      "Judge whether a lead is worth your time better than you can",
    ],
    honestTake:
      "The enrichment data still comes from a data provider, and it should. What this replaces is the $150/mo workflow layer sitting on top of it.",
  },
  "outreach-agent": {
    verdict: "partial",
    job: "Write and run cold email follow-ups.",
    does: [
      "Writes a 4-email sequence where each one adds something new",
      "Drafts the next follow-up for anyone who has not replied",
    ],
    doesNot: [
      "Warm up domains or manage deliverability",
      "Rotate inboxes",
      "Handle suppression lists and compliance for you",
    ],
    honestTake:
      "Partial, and the missing half matters. Sending infrastructure is a real product and burning a domain is expensive. Use this for the writing and keep something that sends properly.",
  },
  "proposal-agent": {
    verdict: "yes",
    job: "Turn call notes into a proposal you can send today.",
    does: [
      "Leads with the client's problem in their own words",
      "Only quotes prices from the list you gave it",
      "Says what is missing rather than inventing scope",
    ],
    doesNot: ["E-signature", "Payment collection", "Version tracking"],
    honestTake:
      "If you use a proposal tool mainly for signatures, keep it. If you use it mainly to avoid writing proposals from scratch, this is that part.",
  },
  "crm-agent": {
    verdict: "partial",
    job: "Keep the pipeline honest and chase what is going cold.",
    does: [
      "Reads your existing CRM through its API",
      "Finds deals with no recent activity and tells you what to say",
      "Reports what actually moved",
    ],
    doesNot: ["Store your pipeline — it reads yours", "Replace your system of record"],
    honestTake:
      "Explicitly partial. Your CRM holds data you would cry about losing, so this sits on top of it rather than replacing it. What it replaces is the discipline of opening it every morning.",
  },
  "meeting-agent": {
    verdict: "partial",
    job: "Turn a call into follow-ups and next steps.",
    does: [
      "Writes the follow-up email from your notes",
      "Lists what was actually committed, and flags what was not clear",
    ],
    doesNot: [
      "Record or transcribe the call — bring the notes",
      "Join the meeting",
    ],
    honestTake:
      "If you pay for a meeting tool for the transcription, keep it. This replaces what you were supposed to do with the transcript afterwards and usually did not.",
  },
  "review-agent": {
    verdict: "yes",
    job: "Reply to every new review before a prospect reads it unanswered.",
    does: [
      "Watches G2, Capterra, Trustpilot and Product Hunt pages",
      "Drafts a reply that names the specific thing the reviewer said",
      "Flags anything low-rated for you to send yourself",
    ],
    doesNot: [
      "Post replies for you — every review platform wants a human account",
      "Ask customers for reviews",
      "Fix the thing they complained about",
    ],
    honestTake:
      "Reputation platforms charge three figures largely for a dashboard and a nudge. The reply itself is the work, and it is the work this does. You still hit send.",
  },
  "inbox-agent": {
    verdict: "partial",
    job: "Answer support email from your own documentation.",
    does: [
      "Answers only from your docs, and says so when the docs do not cover it",
      "Refuses to touch refunds, billing disputes, security and data deletion",
      "Drafts, and sends only if you switch that on",
    ],
    doesNot: [
      "Be your shared inbox, your ticketing, or your SLA reporting",
      "Handle an angry customer",
    ],
    honestTake:
      "Partial, and the refusals are the point. Support is a place where a confident wrong answer costs more than a slow one. This drafts the easy 70% and hands you the rest.",
  },
  "docs-agent": {
    verdict: "yes",
    job: "Write the pages your docs are missing.",
    does: [
      "Reads your docs and lists the questions a new user hits that nothing answers",
      "Writes the most important missing page",
    ],
    doesNot: ["Host your docs", "Handle search or versioning"],
    honestTake:
      "The gap list alone is usually worth more than the page it writes. Most docs tools are hosting; this is the writing.",
  },
  "onboarding-agent": {
    verdict: "partial",
    job: "Get a new user to their first win.",
    does: [
      "Writes the 4-email onboarding sequence around one defined first win",
      "Answers the thing people get stuck on before they hit it",
    ],
    doesNot: ["In-app tours, tooltips, or checklists", "Track product events"],
    honestTake:
      "If your onboarding tool draws tours inside your app, this does not replace it. If it mostly sends emails, it does.",
  },
  "feedback-agent": {
    verdict: "yes",
    job: "Find the signal in what customers said this week.",
    does: [
      "Reads reviews and your feedback tool's API",
      "Groups feedback into themes with counts, ordered by count and not by anger",
      "Names the single thing worth fixing",
    ],
    doesNot: ["Be a public roadmap or a voting board", "Decide what to build"],
    honestTake:
      "Resisting the loudest voice is the hard part of feedback, and counting is how you do it. If you use your feedback tool as a public roadmap, keep it.",
  },
  "seo-agent": {
    verdict: "partial",
    job: "Tell you the exact change to make on each page.",
    does: [
      "Reads your pages and writes the actual replacement title and meta",
      "Compares you to a competitor page you name",
      "Orders findings by impact and says what to ignore",
    ],
    doesNot: [
      "See rankings, search volume, traffic, or backlinks — it reads HTML, not an index",
      "Crawl your whole site",
    ],
    honestTake:
      "Honestly partial, and this is the one people most want to oversell. An SEO suite owns a crawler and an index; we own none of that. What we replace is the part where you knew the fix and never wrote it.",
  },
  "competitor-agent": {
    verdict: "yes",
    job: "Notice the day a competitor changes something.",
    does: [
      "Reads competitor pages daily and reports only real changes",
      "Says 'nothing moved' when nothing moved",
      "Pings Slack when something actually matters",
    ],
    doesNot: ["See their ads, funding, or hiring", "Read anything behind a login"],
    honestTake:
      "Competitive intelligence platforms sell dashboards and a data team. Most founders need one line on a Monday saying whether the pricing page changed. That is what this is.",
  },
  "landing-agent": {
    verdict: "partial",
    job: "Make the homepage make sense in five seconds.",
    does: [
      "Tells you what a stranger thinks your page does — the useful part",
      "Writes three usable headline options, a subhead, and the button text",
      "Says which sections to cut",
    ],
    doesNot: ["Build or host pages", "A/B test", "Design anything"],
    honestTake:
      "A landing page builder is a builder. This is the copywriter you were going to hire and did not. Different job, and you may want both.",
  },
  "ads-agent": {
    verdict: "partial",
    job: "Write ad variants that do not sound like ads.",
    does: [
      "Writes 5 variants on genuinely different angles",
      "Refuses invented social proof, fake urgency and fake scarcity",
    ],
    doesNot: ["Buy media, manage bids, or touch your ad account", "Make creative"],
    honestTake:
      "This is the copy, not the buying. If your ad tool manages spend, keep it — an agent should not be near your daily budget.",
  },
  "community-agent": {
    verdict: "yes",
    job: "Find threads where you can genuinely help.",
    does: [
      "Watches the pages you name for questions you can answer",
      "Drafts a reply that is useful even if nobody clicks anything",
      "Says SKIP when a thread is not a real fit",
    ],
    doesNot: ["Post for you", "Pretend to be a random user"],
    honestTake:
      "Monitoring tools alert you and stop. The reply is the work. And the SKIP rule matters — an agent that replies to everything is how you get banned.",
  },
  "analytics-agent": {
    verdict: "yes",
    job: "Tell you what your numbers did without opening a dashboard.",
    does: [
      "Pulls from any REST analytics API you connect",
      "Always compares to the previous period",
      "Gives one likely explanation, clearly marked as a guess",
    ],
    doesNot: ["Collect the data", "Replace your analytics provider"],
    honestTake:
      "Dashboard products charge you monthly for a page you do not open. The reporting layer is replaceable; the collection layer is not, and we do not touch it.",
  },
  "finance-agent": {
    verdict: "yes",
    job: "Report revenue, churn and what renews next.",
    does: [
      "Reads your billing provider's API",
      "Reports MRR against last period with what moved it",
      "Flags upcoming renewals worth knowing about",
    ],
    doesNot: [
      "Take payments or touch your billing",
      "Replace your accountant or your books",
    ],
    honestTake:
      "Revenue analytics tools are a read-only view on data Stripe already has. That view is replaceable. Stripe is not, and neither is your accountant.",
  },
  "hiring-agent": {
    verdict: "partial",
    job: "Write the job post and screen against what you need.",
    does: [
      "Writes a post that states the stage and the money honestly",
      "Screens on evidence of doing the work, and refuses to comment on name, school, photo, or gaps",
    ],
    doesNot: ["Be your ATS", "Schedule interviews", "Post to job boards"],
    honestTake:
      "An applicant tracking system tracks applicants and you probably still want one. This replaces the writing and the first-pass reading, with hard rules about what it will not look at.",
  },
  "changelog-agent": {
    verdict: "yes",
    job: "Tell customers what shipped, in their language.",
    does: [
      "Reads your commits or merged PRs through the repo API",
      "Writes from the customer's side and skips internal work",
      "Says 'quiet week' when it was one",
    ],
    doesNot: ["Host a changelog widget", "Do in-app announcements"],
    honestTake:
      "If you pay for the in-app widget, keep it. If you pay because writing release notes is a chore nobody does, this is that chore.",
  },
  "research-agent": {
    verdict: "partial",
    job: "Answer the question you would spend two hours googling.",
    does: [
      "Reads the pages you give it and follows the load-bearing links",
      "Says what it could not check — a required section, not optional",
      "Never cites a source it did not open",
    ],
    doesNot: ["Search the whole web", "Access anything paywalled or behind a login"],
    honestTake:
      "A search product has an index. We have the pages you point us at. For a standing question you re-ask every week, that is usually enough. For open-ended discovery, it is not.",
  },
};

function buildFromTemplates(): Replaceable[] {
  const out: Replaceable[] = [];

  for (const template of TEMPLATES) {
    const detail = DETAIL[template.id];
    if (!detail) continue;

    // One page per product name, so someone searching "Hootsuite alternative"
    // lands on a page about Hootsuite rather than about our agent.
    for (const tool of template.replaces.tools) {
      out.push({
        slug: toSlug(tool),
        tool,
        verdict: detail.verdict,
        monthlyUsd: template.replaces.monthlyUsd,
        job: detail.job,
        templateId: template.id,
        does: detail.does,
        doesNot: detail.doesNot,
        honestTake: detail.honestTake,
      });
    }
  }

  return out;
}

/**
 * The long tail, generated by scripts/build-directory.mjs.
 *
 * Hundreds of tools we have a defensible answer about, most of them a "no".
 * The tool names, prices and categories are facts gathered by the
 * canivibecodeit project (MIT); every verdict and every word of the prose is
 * ours, because our question is not theirs — they ask whether you could build
 * it, we ask whether we already run it.
 */
const GENERATED = directoryJson as Replaceable[];

/**
 * Hand-written first.
 *
 * The curated entries above are specific about a named agent and were written
 * one at a time. The generated ones are honest but templated. Where both cover
 * a tool, the hand-written page is the better page, so it wins.
 */
function merge(): Replaceable[] {
  const bySlug = new Map<string, Replaceable>();

  for (const entry of GENERATED) bySlug.set(entry.slug, entry);
  for (const entry of [...buildFromTemplates(), ...NOT_REPLACEABLE]) {
    bySlug.set(entry.slug, entry);
  }

  return [...bySlug.values()].sort((a, b) => a.tool.localeCompare(b.tool));
}

export const REPLACEABLES: Replaceable[] = merge();

const BY_SLUG = new Map(REPLACEABLES.map((entry) => [entry.slug, entry]));

export function getReplaceable(slug: string): Replaceable | undefined {
  return BY_SLUG.get(slug);
}

export function templateFor(entry: Replaceable): AgentTemplate | undefined {
  return entry.templateId
    ? TEMPLATES.find((template) => template.id === entry.templateId)
    : undefined;
}

export const VERDICT_COPY: Record<Verdict, { label: string; short: string }> = {
  yes: { label: "Replaceable", short: "Yes" },
  partial: { label: "Partly replaceable", short: "Partly" },
  no: { label: "Keep paying for it", short: "No" },
};

export function countByVerdict() {
  return {
    yes: REPLACEABLES.filter((entry) => entry.verdict === "yes").length,
    partial: REPLACEABLES.filter((entry) => entry.verdict === "partial").length,
    no: REPLACEABLES.filter((entry) => entry.verdict === "no").length,
    total: REPLACEABLES.length,
  };
}

/** Total monthly list price of everything marked fully replaceable. */
export function replaceableMonthlyTotal(): number {
  const seen = new Set<string>();
  let total = 0;

  for (const entry of REPLACEABLES) {
    if (entry.verdict === "no" || !entry.templateId) continue;
    // Price is per agent, not per product name, so it is counted once.
    if (seen.has(entry.templateId)) continue;
    seen.add(entry.templateId);
    total += entry.monthlyUsd;
  }
  return total;
}
