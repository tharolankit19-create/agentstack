import { getTemplate, type AgentTemplate } from "./templates";

export interface SubAgent { name: string; defaultName: string; does: string; templateId?: string; }
export interface Squad { id: string; name: string; icon: string; mission: string; pipeline: SubAgent[]; output: string; cadence: string; }

export const HEAD_AGENT = {
  id: "head-agent",
  name: "Founder Chief of Staff",
  defaultName: "Kryx",
  icon: "◉",
  mission: "Takes the founder's goal, assembles the smallest useful agent team, chooses cloud or device execution, and brings back finished work plus the decisions that still need the founder.",
  duties: [
    "Turns a founder goal into a small execution plan without exposing workflow-builder complexity",
    "Coordinates research, growth, pipeline and founder-operations work across tools and approved devices",
    "Keeps consequential actions in the founder's approval loop and reports blockers instead of faking completion",
  ],
} as const;

export const SQUADS: Squad[] = [
  {
    id: "intelligence", name: "Market Intelligence", icon: "◌", mission: "Finds what changed, what customers are saying, and what is actually worth reacting to.", cadence: "Daily signal scan; deeper research when needed",
    pipeline: [
      { name: "Market Intelligence Officer", defaultName: "Ida", does: "Researches customers, competitors, communities and trends; separates evidence from guesses and dates every important claim.", templateId: "research-agent" },
      { name: "Growth Analytics Lead", defaultName: "Vera", does: "Reads traffic, conversion and content results; finds the bottleneck and recommends one test instead of a dashboard dump.", templateId: "analytics-agent" },
    ],
    output: "A short evidence-backed brief: what changed, what it means, and the next test.",
  },
  {
    id: "growth", name: "Brand & Growth", icon: "✦", mission: "Turns real founder evidence into content, search demand and pages that convert.", cadence: "Works continuously from new evidence and weekly results",
    pipeline: [
      { name: "Content Strategy Lead", defaultName: "Otis", does: "Writes platform-native X, LinkedIn, Threads, Instagram, YouTube, Medium, email, ad and repurposed drafts in the founder's real voice.", templateId: "content-agent" },
      { name: "Search Authority Lead", defaultName: "Wren", does: "Runs SEO, AEO and GEO: query intent, page fixes, citable answers, internal links, long-form search content and technical checks.", templateId: "seo-agent" },
      { name: "Conversion Specialist", defaultName: "Nell", does: "Audits landing pages, pricing, onboarding and offers; rewrites the highest-impact friction point and designs the next CRO test.", templateId: "landing-agent" },
    ],
    output: "Founder-ready drafts and one measurable growth change, all waiting for approval.",
  },
  {
    id: "pipeline", name: "Revenue Pipeline", icon: "◎", mission: "Finds the right people and writes outreach that has a real reason to exist.", cadence: "Weekdays, or whenever the founder asks for pipeline",
    pipeline: [
      { name: "Lead Research Officer", defaultName: "Rook", does: "Finds and scores real accounts/people against the ICP, keeps only verified matches, and records the trigger that makes outreach timely.", templateId: "lead-agent" },
      { name: "Outreach & Partnerships", defaultName: "Dex", does: "Writes one short, specific message per qualified lead from the real trigger; the founder approves before anything sends.", templateId: "outreach-agent" },
    ],
    output: "A short qualified lead list with specific drafts attached, never invented contacts.",
  },
  {
    id: "founder-ops", name: "Founder Operations", icon: "□", mission: "Keeps the operational work around the founder moving across inbox, documents, meetings and recurring admin.", cadence: "On demand, scheduled, or triggered by a repeated approved workflow",
    pipeline: [
      { name: "Inbox & Follow-up", defaultName: "Mira", does: "Reads allowed inbox context, separates what needs attention, drafts replies and keeps external sends behind approval.", templateId: "inbox-agent" },
      { name: "Docs & Knowledge", defaultName: "Sage", does: "Creates and updates founder-ready docs, briefs, notes and internal knowledge from verified context.", templateId: "docs-agent" },
      { name: "Meetings & Actions", defaultName: "Pax", does: "Turns meeting context into decisions, follow-ups and next actions without losing ownership or deadlines.", templateId: "meeting-agent" },
      { name: "Finance & Admin", defaultName: "Vale", does: "Summarizes allowed financial/admin context and prepares non-transactional follow-up; payments and sensitive account actions stay restricted.", templateId: "finance-agent" },
    ],
    output: "A cleaned-up founder queue: what changed, what is ready, and what still needs a decision.",
  },
];

export const ABSORBED_SKILLS: Record<string, string[]> = {
  "research-agent": ["competitor-agent", "community-agent", "feedback-agent"],
  "analytics-agent": ["crm-agent"],
  "content-agent": ["repurpose-agent", "blog-agent", "newsletter-agent", "ads-agent", "video-script-agent", "changelog-agent", "proposal-agent"],
  "seo-agent": [],
  "landing-agent": ["onboarding-agent", "review-agent"],
  "lead-agent": ["crm-agent", "hiring-agent"],
};

export function armyWithTemplates(): { squad: Squad; steps: { sub: SubAgent; template?: AgentTemplate }[] }[] {
  return SQUADS.map((squad) => ({ squad, steps: squad.pipeline.map((sub) => { if (!sub.templateId) return { sub }; const template = getTemplate(sub.templateId); if (!template) throw new Error(`Squad "${squad.name}" references template "${sub.templateId}", which does not exist.`); return { sub, template }; }) }));
}
export function armyTemplateIds(): string[] { return [...new Set(SQUADS.flatMap((squad) => squad.pipeline.map((sub) => sub.templateId).filter(Boolean)))] as string[]; }
export function rosterTemplateIds(): string[] { return [HEAD_AGENT.id, ...armyTemplateIds()]; }
export function totalAgentCount(): number { return 1 + SQUADS.reduce((sum, squad) => sum + squad.pipeline.length, 0); }

export interface RosterMember { templateId: string; name: string; role: string; does: string; squadId: string | null; squadName: string | null; step: number; }
export function roster(): RosterMember[] {
  const head: RosterMember = { templateId: HEAD_AGENT.id, name: HEAD_AGENT.defaultName, role: HEAD_AGENT.name, does: HEAD_AGENT.mission, squadId: null, squadName: null, step: 0 };
  return [head, ...SQUADS.flatMap((squad) => squad.pipeline.map((sub, index) => ({ templateId: sub.templateId ?? `${squad.id}-${index}`, name: sub.defaultName, role: sub.name, does: sub.does, squadId: squad.id, squadName: squad.name, step: index })))];
}
const BY_TEMPLATE = new Map(roster().map((member) => [member.templateId, member]));
export function memberFor(templateId: string): RosterMember | undefined { return BY_TEMPLATE.get(templateId); }
export function displayName(templateId: string, saved?: string | null, fallback?: string | null): string { const member = BY_TEMPLATE.get(templateId); if (saved && saved !== fallback) return saved; return member?.name ?? saved ?? fallback ?? "Agent"; }
