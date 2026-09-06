import { getTemplate, type AgentTemplate } from "./templates";

/**
 * The org chart, as data.
 *
 * A head agent that talks to the founder, and squads underneath it that do the
 * work. This is the product's shape, so it lives in one file that the landing
 * page, the workflow animation and the dashboard all read — rather than three
 * hand-maintained copies that drift the first time a squad changes.
 *
 * **The squads are not new agents.** They are the agents that already exist and
 * already run, grouped by the job they do. That distinction matters: a
 * repositioning that invents six agents nobody has built is a landing page
 * writing cheques the engine cannot cash. Every `templateId` below resolves to
 * a real template in the catalog, and `armyWithTemplates()` throws at build
 * time if one does not.
 */

export interface SubAgent {
  /** The role — what this step does. */
  name: string;
  /**
   * What it is called. Not optional.
   *
   * An org chart where two of the fourteen are "Writer" and the rest have
   * names is worse than one with no names at all — the founder cannot tell you
   * which Writer wrote the thing. Every member of the army answers to a name,
   * and the type enforces it so a new squad cannot be added without one.
   */
  defaultName: string;
  /** What this step actually does, in the words of someone who has run it. */
  does: string;
  /** The catalog agent that performs it, if one does. */
  templateId?: string;
}

export interface Squad {
  id: string;
  name: string;
  icon: string;
  /** The one-line job. Shown on the node in the workflow diagram. */
  mission: string;
  /** Ordered — these run as a pipeline, not in parallel. */
  pipeline: SubAgent[];
  /** What the founder gets at the end of it. */
  output: string;
  /** Roughly when it runs, in human words. */
  cadence: string;
}

export const HEAD_AGENT = {
  id: "head-agent",
  /**
   * The role. What it is.
   */
  name: "Head Agent",
  /**
   * The default name it introduces itself with.
   *
   * A thing you message every morning needs a name, not a job title — "Seamus
   * says three leads came in" is a colleague; "Head Agent says" is a cron job.
   * The founder can rename it, and most will; this is what it is called until
   * they do.
   */
  defaultName: "Seamus",
  icon: "🎖️",
  mission:
    "Reads everything the squads produced, decides what actually matters, and messages you one briefing.",
  /** The three things it does that no squad does. */
  duties: [
    "Compiles every squad's output into one morning briefing",
    "Sends it to your Telegram at the time you choose",
    "Waits for your reply — nothing publishes or sends until you say so",
  ],
} as const;

const CATALOG_SQUADS: Squad[] = [
  {
    id: "research",
    name: "Research Squad",
    icon: "🔬",
    mission: "Finds what your market is asking about this week.",
    cadence: "Every morning",
    pipeline: [
      {
        name: "Researcher",
        defaultName: "Ida",
        does: "Reads the sources you name and follows the links that matter.",
        templateId: "research-agent",
      },
      {
        name: "Post Analyzer",
        defaultName: "Vera",
        does: "Works out which angles are getting traction and which are exhausted.",
        templateId: "analytics-agent",
      },
    ],
    output: "A brief: what to talk about, and why this week rather than last.",
  },
  {
    id: "content",
    name: "Content Squad",
    icon: "✍️",
    mission: "Turns the brief into things you can actually post.",
    cadence: "Every weekday",
    pipeline: [
      {
        name: "Writer",
        defaultName: "Otis",
        does: "Drafts the posts, the thread, and the long piece from your own material.",
        templateId: "content-agent",
      },
      {
        name: "Optimizer",
        defaultName: "Nell",
        does: "Rewrites the hook, tightens the CTA, cuts what nobody reads.",
        templateId: "landing-agent",
      },
      {
        name: "Repurposer",
        defaultName: "Cass",
        does: "Cuts one long piece into a week of short ones.",
        templateId: "repurpose-agent",
      },
    ],
    output: "Drafts waiting for approval. Nothing posts on its own.",
  },
  {
    id: "search",
    name: "Search Squad",
    icon: "🔍",
    mission: "Gets you found — in Google, and in the AI answers that now sit above it.",
    cadence: "Weekly, plus a long piece",
    pipeline: [
      {
        name: "SEO Auditor",
        defaultName: "Wren",
        does: "Audits your pages and writes the exact title, meta and fix for each one.",
        templateId: "seo-agent",
      },
      {
        name: "Long-form Writer",
        defaultName: "Bram",
        does: "Writes the piece with an argument, built to be quoted by an AI answer.",
        templateId: "blog-agent",
      },
      {
        name: "Docs Writer",
        defaultName: "Isla",
        does: "Keeps what you have written explaining the current product, not last quarter's.",
        templateId: "docs-agent",
      },
    ],
    output: "The one change worth making this week, written out ready to paste.",
  },
  {
    id: "demand",
    name: "Demand Squad",
    icon: "📣",
    mission: "The paid and owned channels — ads, email list, video.",
    cadence: "Weekly",
    pipeline: [
      {
        name: "Ads Writer",
        defaultName: "Kit",
        does: "Writes three genuinely different angles, not three rewrites of one.",
        templateId: "ads-agent",
      },
      {
        name: "Newsletter Writer",
        defaultName: "Peg",
        does: "Writes the email people open, with a subject that tells the truth.",
        templateId: "newsletter-agent",
      },
      {
        name: "Video Scripter",
        defaultName: "Hugo",
        does: "Turns an angle into a script with a hook that survives a scroll.",
        templateId: "video-script-agent",
      },
    ],
    output: "Ad angles, a newsletter draft, and a script — all waiting on you.",
  },
  {
    id: "intel",
    name: "Competitor Intel",
    icon: "🕵️",
    mission: "Notices the day a competitor changes something.",
    cadence: "Daily",
    pipeline: [
      {
        name: "Watcher",
        defaultName: "Argus",
        does: "Reads competitor pages daily and reports only real changes.",
        templateId: "competitor-agent",
      },
    ],
    output: "One line on a Monday, or 'nothing moved' — which is also useful.",
  },
  {
    id: "hype",
    name: "Hype Squad",
    icon: "📡",
    mission: "Filters the noise down to the trends your buyer actually cares about.",
    cadence: "Daily",
    pipeline: [
      {
        name: "Trend Scanner",
        defaultName: "Juno",
        does: "Watches the communities where your customers already are.",
        templateId: "community-agent",
      },
      {
        name: "Person Filter",
        defaultName: "Pike",
        does: "Drops anything that does not match your ICP. Says SKIP a lot.",
        templateId: "feedback-agent",
      },
    ],
    output: "Two or three trends worth a post, with the angle already written.",
  },
  {
    id: "outreach",
    name: "Cold Outreach Squad",
    icon: "🎯",
    mission: "Finds people worth talking to and writes the first line.",
    cadence: "Every weekday",
    pipeline: [
      {
        name: "Leads Finder",
        defaultName: "Rook",
        does: "Turns a plain-English ICP into a real search and returns matches.",
        templateId: "lead-agent",
      },
      {
        name: "Leads Filter",
        defaultName: "Sift",
        does: "Scores each lead and keeps only the ones worth your time.",
        templateId: "crm-agent",
      },
      {
        name: "Outreach Writer",
        defaultName: "Dex",
        does: "Writes one specific email per lead. No merge fields.",
        templateId: "outreach-agent",
      },
    ],
    output: "A short list with drafts attached — you press send, not the agent.",
  },
  {
    id: "ops",
    name: "Operations Squad",
    icon: "📋",
    mission: "The occasional jobs — proposals, releases, numbers, hiring.",
    cadence: "When there is something to report",
    pipeline: [
      {
        name: "Proposal Writer",
        defaultName: "Ines",
        does: "Turns a call into a proposal that reads like you wrote it.",
        templateId: "proposal-agent",
      },
      {
        name: "Changelog Writer",
        defaultName: "Ravi",
        does: "Turns what shipped into something a customer would actually read.",
        templateId: "changelog-agent",
      },
      {
        name: "Onboarding Writer",
        defaultName: "Suki",
        does: "Writes the messages that get a new signup to their first win.",
        templateId: "onboarding-agent",
      },
      {
        name: "Meeting Prep",
        defaultName: "Milo",
        does: "Reads who you are meeting and hands you the three things to know.",
        templateId: "meeting-agent",
      },
      {
        name: "Finance Watcher",
        defaultName: "Orla",
        does: "Watches the numbers that matter and flags the one that moved.",
        templateId: "finance-agent",
      },
      {
        name: "Hiring Writer",
        defaultName: "Tova",
        does: "Writes the role post and the outreach to the people worth it.",
        templateId: "hiring-agent",
      },
    ],
    output: "Whatever the week needed, drafted and waiting.",
  },
  {
    id: "reputation",
    name: "Reputation Squad",
    icon: "⭐",
    mission: "Answers every review before a prospect reads it unanswered.",
    cadence: "Every 6 hours",
    pipeline: [
      {
        name: "Review Watcher",
        defaultName: "Mira",
        does: "Watches G2, Capterra, Trustpilot and Product Hunt.",
        templateId: "review-agent",
      },
      {
        name: "Reply Drafter",
        defaultName: "Bea",
        does: "Names the specific thing the reviewer said. Escalates the angry ones.",
        templateId: "inbox-agent",
      },
    ],
    output: "Replies drafted, bad ones flagged for you personally.",
  },
];

/**
 * The squads with their real templates attached.
 *
 * Throws when a `templateId` does not resolve, which is the whole reason this
 * function exists: a squad pointing at an agent that was renamed or removed is
 * a landing page describing something that cannot run, and it should fail the
 * build rather than ship.
 */
const LAUNCH_ROLES = new Set([
  "research-agent", "analytics-agent", "content-agent", "landing-agent",
  "seo-agent", "blog-agent", "ads-agent", "newsletter-agent",
  "competitor-agent", "community-agent", "lead-agent", "outreach-agent",
]);

export const SQUADS: Squad[] = CATALOG_SQUADS.map(squad => ({
  ...squad, pipeline: squad.pipeline.filter(member => member.templateId && LAUNCH_ROLES.has(member.templateId)),
})).filter(squad => squad.pipeline.length > 0);

export function armyWithTemplates(): {
  squad: Squad;
  steps: { sub: SubAgent; template?: AgentTemplate }[];
}[] {
  return SQUADS.map((squad) => ({
    squad,
    steps: squad.pipeline.map((sub) => {
      if (!sub.templateId) return { sub };
      const template = getTemplate(sub.templateId);
      if (!template) {
        throw new Error(
          `Squad "${squad.name}" references template "${sub.templateId}", which does not exist. ` +
            "Either the template was renamed or the squad is describing an agent nobody built.",
        );
      }
      return { sub, template };
    }),
  }));
}

/** Every template the army actually uses, deduplicated. */
export function armyTemplateIds(): string[] {
  return [
    ...new Set(
      SQUADS.flatMap((squad) =>
        squad.pipeline.map((sub) => sub.templateId).filter(Boolean),
      ),
    ),
  ] as string[];
}

/**
 * The roster: the head agent plus every squad member, in deploy order.
 *
 * The catalog still holds every template — the public directory at /replace
 * maps 891 tools onto them and would break if they were deleted. But the
 * dashboard shows *this* list and nothing else, because a founder who bought
 * a marketing army should see their army, not a warehouse of everything the
 * engine can run.
 *
 * Head agent first, deliberately. It is the one that has to exist for any of
 * the others to be worth deploying.
 */
export function rosterTemplateIds(): string[] {
  return [HEAD_AGENT.id, ...armyTemplateIds()];
}

export function totalAgentCount(): number {
  return rosterTemplateIds().length;
}

/** One member of the army, flattened out of the org chart. */
export interface RosterMember {
  /** The template it runs on, which is also its identity in the `agents` table. */
  templateId: string;
  /** What it is called. */
  name: string;
  /** What it does — the job title under the name. */
  role: string;
  /** One line, in the words of someone who has watched it run. */
  does: string;
  /** The squad it belongs to, or null for the head agent. */
  squadId: string | null;
  squadName: string | null;
  /** Its position in the squad's pipeline, so the UI can draw the arrows. */
  step: number;
}

/**
 * Every agent the founder actually gets, head agent first.
 *
 * The dashboard, the usage table and the agent pages all read this instead of
 * reaching for `template.name`. Templates are named after the job ("Content
 * Agent") because the public directory needs them to be searchable; the army
 * is named after the people, because you do not thank "Content Agent" for a
 * good post.
 */
export function roster(): RosterMember[] {
  const head: RosterMember = {
    templateId: HEAD_AGENT.id,
    name: HEAD_AGENT.defaultName,
    role: HEAD_AGENT.name,
    does: HEAD_AGENT.mission,
    squadId: null,
    squadName: null,
    step: 0,
  };

  return [
    head,
    ...SQUADS.flatMap((squad) =>
      squad.pipeline.map((sub, index) => ({
        templateId: sub.templateId ?? `${squad.id}-${index}`,
        name: sub.defaultName,
        role: sub.name,
        does: sub.does,
        squadId: squad.id,
        squadName: squad.name,
        step: index,
      })),
    ),
  ];
}

const BY_TEMPLATE = new Map(roster().map((member) => [member.templateId, member]));

/** The army member that runs on a template, if the template is in the army. */
export function memberFor(templateId: string): RosterMember | undefined {
  return BY_TEMPLATE.get(templateId);
}

/**
 * The name to show for an agent row.
 *
 * Priority: what the founder renamed it to, then its army name, then the
 * template's job title. The last one only fires for custom agents built from a
 * pasted URL, which have no place in the org chart by definition.
 */
export function displayName(
  templateId: string,
  saved?: string | null,
  fallback?: string | null,
): string {
  const member = BY_TEMPLATE.get(templateId);
  // A saved name that is just the old template title is not a rename — it is
  // what the create route wrote before names existed, and showing it would
  // undo the whole thing for every account created before today.
  if (saved && saved !== fallback) return saved;
  return member?.name ?? saved ?? fallback ?? "Agent";
}
