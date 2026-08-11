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
  name: string;
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
  name: "Head Agent",
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

export const SQUADS: Squad[] = [
  {
    id: "research",
    name: "Research Squad",
    icon: "🔬",
    mission: "Finds what your market is asking about this week.",
    cadence: "Every morning",
    pipeline: [
      {
        name: "Researcher",
        does: "Reads the sources you name and follows the links that matter.",
        templateId: "research-agent",
      },
      {
        name: "Post Analyzer",
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
        does: "Drafts the posts, the thread, and the long piece from your own material.",
        templateId: "content-agent",
      },
      {
        name: "Optimizer",
        does: "Rewrites the hook, tightens the CTA, cuts what nobody reads.",
        templateId: "landing-agent",
      },
      {
        name: "Repurposer",
        does: "Cuts one long piece into a week of short ones.",
        templateId: "repurpose-agent",
      },
    ],
    output: "Drafts waiting for approval. Nothing posts on its own.",
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
        does: "Watches the communities where your customers already are.",
        templateId: "community-agent",
      },
      {
        name: "Person Filter",
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
        does: "Turns a plain-English ICP into a real search and returns matches.",
        templateId: "lead-agent",
      },
      {
        name: "Leads Filter",
        does: "Scores each lead and keeps only the ones worth your time.",
        templateId: "crm-agent",
      },
      {
        name: "Writer",
        does: "Writes one specific email per lead. No merge fields.",
        templateId: "outreach-agent",
      },
    ],
    output: "A short list with drafts attached — you press send, not the agent.",
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
        does: "Watches G2, Capterra, Trustpilot and Product Hunt.",
        templateId: "review-agent",
      },
      {
        name: "Reply Drafter",
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
  return SQUADS.reduce((sum, squad) => sum + squad.pipeline.length, 0);
}
