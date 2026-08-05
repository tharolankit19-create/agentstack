#!/usr/bin/env node
/**
 * Builds the public /replace directory.
 *
 * The directory used to cover only the tools our own agent configs name — 56
 * pages, all of them "yes". That is an advertisement. This turns it into a
 * reference: several hundred tools, most of which we tell you to keep paying
 * for, each mapped to the agent that does the job or to the reason no agent
 * should.
 *
 * ## Where the input comes from
 *
 * The tool list, prices and categories are facts, and they were gathered by
 * the canivibecodeit project (MIT, github.com/canivibecodeit/canivibecodeit).
 * We take the facts and nothing else — no verdict, no summary, no prose. Every
 * word a visitor reads on our pages is written here, against our own catalog,
 * because our answer to "can this be replaced" is a different question from
 * theirs: they ask whether you can build it, we ask whether we already run it.
 *
 * Run with the dataset checked out next to this repo:
 *
 *   node scripts/build-directory.mjs ../canivibecodeit/data/apps
 *
 * Without an input directory it leaves the committed output alone, so a normal
 * build never depends on having the dataset on disk.
 */

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const OUT = resolve("apps/web/src/data/directory.json");

/* -------------------------------------------------------------------------
 * Category → the agent that does that job.
 *
 * A category maps to an agent only when the agent genuinely does the work the
 * category describes. Everything unmapped becomes a "keep paying" page, which
 * is the honest default and also the more useful page.
 * ---------------------------------------------------------------------- */

const AGENT_FOR_CATEGORY = {
  "seo-marketing": "seo-agent",
  analytics: "analytics-agent",
  "social-media": "content-agent",
  newsletter: "newsletter-agent",
  "ai-writing": "blog-agent",
  "writing-assistant": "blog-agent",
  "sales-outreach": "outreach-agent",
  crm: "crm-agent",
  "customer-support": "inbox-agent",
  "meeting-notes": "meeting-agent",
  "video-conferencing": null, // the call itself is not a writing job
  "finance-accounting": "finance-agent",
  "personal-finance": "finance-agent",
  hr: "hiring-agent",
  career: "hiring-agent",
  "user-research": "feedback-agent",
  testimonials: "review-agent",
  community: "community-agent",
  podcasting: "repurpose-agent",
  "ai-video": "video-script-agent",
  "screen-recording": null, // capture is not a language job
  documents: "docs-agent",
  "notes-knowledge": "docs-agent",
  scheduling: null,
  monitoring: null,
  uptime: null,
};

/* Categories that are infrastructure, a system of record, or a canvas. An
   agent has no job here and saying so is the point of the directory. */
const KEEP_PAYING_REASON = {
  databases: "system-of-record",
  hosting: "infrastructure",
  "cloud-storage": "infrastructure",
  security: "infrastructure",
  "dev-tools": "infrastructure",
  automation: "infrastructure",
  cron: "infrastructure",
  design: "canvas",
  whiteboard: "canvas",
  "photo-editing": "canvas",
  diagrams: "canvas",
  presentations: "canvas",
  "ai-image": "canvas",
  "generative-media": "canvas",
  "website-builder": "canvas",
  "no-code-apps": "canvas",
  commerce: "system-of-record",
  "creator-commerce": "system-of-record",
  legal: "expensive-to-be-wrong",
  "time-tracking": "system-of-record",
  "project-management": "system-of-record",
  tasks: "system-of-record",
  "tasks-calendar": "system-of-record",
  "video-conferencing": "realtime",
  "screen-recording": "realtime",
  "voice-ai": "realtime",
  audio: "realtime",
  "ai-audio": "realtime",
  "audio-video": "realtime",
  "voice-dictation": "realtime",
  scheduling: "system-of-record",
  monitoring: "infrastructure",
  uptime: "infrastructure",
  wellness: "not-work",
  home: "not-work",
  travel: "not-work",
  education: "not-work",
  reading: "not-work",
  "read-it-later": "not-work",
  bookmarks: "not-work",
};

/* One paragraph per reason. Written here, once, so every "no" page says
   something true and specific rather than the same shrug. */
const KEEP_PAYING_COPY = {
  "system-of-record": {
    doesNot: ["Be the place your data lives", "Be trusted with the only copy"],
    take: (tool) =>
      `${tool} is a system of record: the value is that it remembers, reliably, and that everyone on your team is looking at the same thing. An agent is a good reader of that data and a bad owner of it. Ours can report on what is in there — that is what the Analytics and Finance agents do — but the record itself should stay where it is.`,
  },
  infrastructure: {
    doesNot: ["Run your infrastructure", "Be on-call for you"],
    take: (tool) =>
      `This is infrastructure, not work. ${tool} is not charging you for a task somebody does each week; it is charging you for something that has to be up at 3am. There is no job here for a language model on a schedule, and putting one in the path only adds a way for it to break.`,
  },
  canvas: {
    doesNot: ["Have taste", "Replace the person holding the pen"],
    take: (tool) =>
      `${tool} is a canvas. What you pay for is the making — the judgement, the iteration, the moment where you see it and change your mind. Agents are useful either side of that (a brief before, a description after) and useless in the middle of it. Keep the tool.`,
  },
  "expensive-to-be-wrong": {
    doesNot: ["Give you advice you can rely on", "Carry any of the risk"],
    take: (tool) =>
      `Being wrong here is expensive in a way that is hard to undo. ${tool} exists so a professional is accountable for the answer. An agent can prepare, summarise and draft — but the thing you are actually buying is that somebody is responsible, and we cannot sell you that.`,
  },
  realtime: {
    doesNot: ["Be in the room", "Do anything in real time"],
    take: (tool) =>
      `${tool} does its work live, while it is happening. Our agents run on a schedule and think in text; neither of those is what a real-time capture tool is for. What we can replace is the part that happens afterwards — the notes, the summary, the follow-up — and that is a different product to this one.`,
  },
  "not-work": {
    doesNot: ["Do this for you", "Be worth automating"],
    take: (tool) =>
      `Honestly: this is not a business process, and automating it would take the point out of it. We build agents for the jobs you would rather not do. ${tool} is not one of those, and we would rather say so than sell you something.`,
  },
};

/* -------------------------------------------------------------------------
 * Per-agent prose. Our words, about our agents.
 * ---------------------------------------------------------------------- */

const AGENT_COPY = {
  "seo-agent": {
    verdict: "partial",
    job: (tool) => `Find what to write next, the way ${tool} is used for.`,
    does: [
      "Reads the pages you name and the ones ranking around them",
      "Comes back with topics, angles and the brief for each",
      "Runs weekly, so the list is never stale",
    ],
    doesNot: ["Crawl an index of the whole web", "Give you backlink or keyword-volume data"],
    take: (tool) =>
      `${tool} sells you an index, and we do not have one. What most people actually open it for is the shortlist — what to write, what to fix, what competitors are doing — and that part is a reading job an agent does every week without being asked. If you need the raw data, keep ${tool}. If you needed the shortlist, you did not need ${tool}.`,
  },
  "analytics-agent": {
    verdict: "partial",
    job: (tool) => `Say what the numbers did, without opening ${tool}.`,
    does: [
      "Pulls from any REST analytics API you connect",
      "Always compares against the previous period",
      "Offers one likely explanation, clearly marked as a guess",
    ],
    doesNot: ["Collect the data", "Replace the thing doing the measuring"],
    take: (tool) =>
      `There are two products inside ${tool}: something that collects data, and a dashboard on top of it. The collection is real infrastructure and we do not touch it. The dashboard is a page you pay for monthly and open rarely, and an agent that emails you the same numbers with the change already worked out is usually the better version of it.`,
  },
  "content-agent": {
    verdict: "yes",
    job: (tool) => `Write and schedule the posts ${tool} is holding.`,
    does: [
      "Writes in the voice you describe, from your own material",
      "Produces a week at a time, on a schedule",
      "Keeps a record of everything it has published",
    ],
    doesNot: ["Post to networks that ban automated posting", "Manage a team approval queue"],
    take: (tool) =>
      `Scheduling is the cheap half of ${tool}; the expensive half is that somebody has to write the things. If you are paying a monthly fee mostly to stare at an empty queue, an agent that fills it is the actual fix. If you have a team with an approval workflow, keep ${tool} — we are not that.`,
  },
  "newsletter-agent": {
    verdict: "partial",
    job: (tool) => `Write the issue, so ${tool} has something to send.`,
    does: [
      "Drafts the issue from sources you name",
      "Keeps a consistent format week to week",
      "Runs on the day you actually send",
    ],
    doesNot: ["Deliver email", "Hold your subscriber list or handle unsubscribes"],
    take: (tool) =>
      `Sending email properly is deliverability work — reputation, bounces, one-click unsubscribe, the law — and it is worth paying for. Keep ${tool}. What an agent replaces is the blank page every week, which is the reason most newsletters quietly stop.`,
  },
  "blog-agent": {
    verdict: "yes",
    job: (tool) => `Draft the long piece you opened ${tool} to write.`,
    does: [
      "Researches from sources you point it at before drafting",
      "Writes a full piece, not an outline",
      "Runs on a schedule so the blog does not go quiet",
    ],
    doesNot: ["Publish without you reading it", "Invent a citation"],
    take: (tool) =>
      `${tool} is a text box with a model behind it, and you are the one who has to remember to open it. The difference here is the schedule: a draft is waiting on Monday whether or not you remembered. That is most of why one blog is alive and another is not.`,
  },
  "outreach-agent": {
    verdict: "partial",
    job: (tool) => `Write the emails ${tool} would send.`,
    does: [
      "Researches each recipient before writing to them",
      "Writes one specific email rather than a merge field",
      "Refuses fake urgency and invented compliments",
    ],
    doesNot: ["Send the mail", "Warm up inboxes or manage deliverability"],
    take: (tool) =>
      `Sending cold email at volume is a deliverability problem, and ${tool} solves it properly. Keep it if that is why you pay. The part worth replacing is the writing — the reason the reply rate is low is almost never the sending.`,
  },
  "crm-agent": {
    verdict: "partial",
    job: (tool) => `Keep ${tool} up to date without you doing it.`,
    does: [
      "Reads your pipeline through the API and says what actually changed",
      "Flags deals that have gone quiet",
      "Drafts the follow-up that is overdue",
    ],
    doesNot: ["Be your CRM", "Hold customer records"],
    take: (tool) =>
      `Keep ${tool}. A CRM is a system of record and the whole value is that it is the one place everyone trusts. What an agent replaces is the admin around it — the updating, the noticing, the chasing — which is the part nobody does and the reason CRMs rot.`,
  },
  "inbox-agent": {
    verdict: "partial",
    job: (tool) => `Draft the replies sitting in ${tool}.`,
    does: [
      "Drafts answers from your own docs and past replies",
      "Escalates anything angry, legal or refund-shaped instead of answering it",
      "Never sends on its own",
    ],
    doesNot: ["Be the helpdesk", "Own the ticket queue or your SLAs"],
    take: (tool) =>
      `If you have a support team, keep ${tool} — routing, ownership and history are the product. If support is you, at night, answering the same eight questions, then the queue is not the problem and an agent that has the reply already written is the fix.`,
  },
  "meeting-agent": {
    verdict: "partial",
    job: (tool) => `Turn the transcript into what happens next.`,
    does: [
      "Takes a transcript and returns decisions, owners and dates",
      "Writes the follow-up email",
      "Says plainly when a meeting produced no decision",
    ],
    doesNot: ["Join the call", "Record or transcribe audio"],
    take: (tool) =>
      `${tool} has to be in the meeting, and we cannot be. Keep whatever records and transcribes. What is genuinely replaceable is the hour afterwards where somebody turns 40 minutes of talking into three things to do — and unlike the meeting, that part is text.`,
  },
  "finance-agent": {
    verdict: "partial",
    job: (tool) => `Report the revenue ${tool} is charting.`,
    does: [
      "Reads your billing provider's API directly",
      "Reports against last period with what moved it",
      "Flags renewals worth knowing about before they land",
    ],
    doesNot: ["Take payments", "Replace your books or your accountant"],
    take: (tool) =>
      `${tool} is a read-only view of data Stripe already has. The view is replaceable. The payments are not, and neither is anybody who signs off on your numbers.`,
  },
  "hiring-agent": {
    verdict: "partial",
    job: (tool) => `Write the post and read the first pass.`,
    does: [
      "Writes a job post that states the stage and the money honestly",
      "Screens on evidence of doing the work",
      "Refuses to comment on name, school, photo or gaps",
    ],
    doesNot: ["Be your ATS", "Schedule interviews", "Post to job boards"],
    take: (tool) =>
      `You probably still want ${tool} to track candidates — that is a record, and records should stay put. What this replaces is the writing and the first read, under hard rules about what it will not look at.`,
  },
  "feedback-agent": {
    verdict: "yes",
    job: (tool) => `Turn what customers said into what to build.`,
    does: [
      "Groups feedback by the underlying problem, not the words used",
      "Counts how many people hit each one",
      "Names the smallest change that would fix the biggest group",
    ],
    doesNot: ["Host a public roadmap or a voting board", "Collect the feedback for you"],
    take: (tool) =>
      `If customers vote on a public board, keep ${tool} — the board is the product. If you are paying so that somebody eventually reads it all, that reading is the job, and it is exactly what a model on a schedule is good at.`,
  },
  "review-agent": {
    verdict: "yes",
    job: (tool) => `Reply to every review like a person did.`,
    does: [
      "Writes a specific reply to each review, good or bad",
      "Escalates anything that should not get a canned answer",
      "Runs daily so nothing sits for a week",
    ],
    doesNot: ["Post the reply without you", "Get you more reviews"],
    take: (tool) =>
      `${tool} mostly tells you a review exists. Knowing was never the hard part — writing 40 individual replies is, and that is the entire monthly fee for most people who pay it.`,
  },
  "community-agent": {
    verdict: "partial",
    job: (tool) => `Find the threads worth answering.`,
    does: [
      "Watches the places you name for questions you can genuinely answer",
      "Drafts a reply that is useful even if nobody clicks anything",
      "Says SKIP when a thread is not a real fit",
    ],
    doesNot: ["Post for you", "Pretend to be a random enthusiastic user"],
    take: (tool) =>
      `Monitoring alerts you and stops; the reply is the work. The SKIP rule is the important part — an agent that answers everything is how a brand gets banned from the exact community it wanted to be in.`,
  },
  "repurpose-agent": {
    verdict: "yes",
    job: (tool) => `Cut one long thing into the ten short ones.`,
    does: [
      "Takes a transcript or a post and finds the moments that stand alone",
      "Rewrites each for the place it is going",
      "Keeps the meaning instead of chopping on time",
    ],
    doesNot: ["Edit video or audio", "Render or caption anything"],
    take: (tool) =>
      `If ${tool} is doing the actual cutting and rendering, keep it. If you are paying for something to decide which 40 seconds matter, that is a judgement about language and it is the cheaper half of the problem.`,
  },
  "video-script-agent": {
    verdict: "partial",
    job: (tool) => `Write the script before anything gets made.`,
    does: [
      "Writes a script with the hook in the first line",
      "Writes for the length and the platform you name",
      "Produces variants worth testing against each other",
    ],
    doesNot: ["Generate video", "Do voice, footage or editing"],
    take: (tool) =>
      `${tool} makes the video; the words are still yours to find. This is the words. It is genuinely not the same purchase, and if what you need is generation, keep paying.`,
  },
  "docs-agent": {
    verdict: "partial",
    job: (tool) => `Keep the documentation honest.`,
    does: [
      "Reads what shipped and finds the docs that are now wrong",
      "Writes the update as a diff you can accept",
      "Runs after every release instead of every quarter",
    ],
    doesNot: ["Host your docs", "Be the wiki everybody edits"],
    take: (tool) =>
      `Keep ${tool} for hosting and search. The thing that fails is not the hosting — it is that documentation goes stale in weeks and nobody is assigned to notice. An agent reading each release against the docs is assigned to notice.`,
  },
};

/* -------------------------------------------------------------------------
 * Build
 * ---------------------------------------------------------------------- */

function toSlug(value) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function main() {
  const input = process.argv[2];
  if (!input) {
    console.log("[directory] no input directory given; leaving the committed file alone");
    return;
  }

  const files = readdirSync(input).filter((f) => f.endsWith(".json"));
  const entries = [];
  const seen = new Set();

  for (const file of files) {
    let app;
    try {
      app = JSON.parse(readFileSync(join(input, file), "utf8"));
    } catch {
      continue;
    }

    const slug = toSlug(app.name ?? "");
    if (!slug || seen.has(slug)) continue;

    const category = app.category ?? "";
    const agentId = AGENT_FOR_CATEGORY[category] ?? null;
    const copy = agentId ? AGENT_COPY[agentId] : null;

    // A category we have not classified at all is left out rather than guessed
    // at. A directory is only useful while every page in it is defensible.
    const reason = KEEP_PAYING_REASON[category];
    if (!copy && !reason) continue;

    seen.add(slug);

    const price = Number.isFinite(app.priceMonthly) ? Math.round(app.priceMonthly) : 0;
    // The domain is what lets a row show the tool's own icon. It is also the
    // only field here a reader could use to check we mean the product they
    // think we mean — there are three companies called Bolt.
    const domain = typeof app.domain === "string" ? app.domain : undefined;
    // The dataset's own editorial ranking, used to pick which logos are worth
    // putting above the fold. Higher is more prominent.
    const priority = Number.isFinite(app.pagePriority) ? app.pagePriority : 3;

    if (copy) {
      entries.push({
        slug,
        tool: app.name,
        domain,
        priority,
        verdict: copy.verdict,
        monthlyUsd: price,
        job: copy.job(app.name),
        templateId: agentId,
        does: copy.does,
        doesNot: copy.doesNot,
        honestTake: copy.take(app.name),
      });
    } else {
      const keep = KEEP_PAYING_COPY[reason];
      entries.push({
        slug,
        tool: app.name,
        domain,
        priority,
        verdict: "no",
        monthlyUsd: price,
        job: `What ${app.name} is for, we do not do.`,
        templateId: null,
        does: [],
        doesNot: keep.doesNot,
        honestTake: keep.take(app.name),
      });
    }
  }

  entries.sort((a, b) => a.tool.localeCompare(b.tool));

  const counts = entries.reduce(
    (acc, e) => ({ ...acc, [e.verdict]: (acc[e.verdict] ?? 0) + 1 }),
    {},
  );

  writeFileSync(OUT, `${JSON.stringify(entries, null, 2)}\n`);
  console.log(
    `[directory] ${entries.length} tools → ${OUT}\n` +
      `[directory] yes ${counts.yes ?? 0} · partial ${counts.partial ?? 0} · no ${counts.no ?? 0}`,
  );
}

main();
