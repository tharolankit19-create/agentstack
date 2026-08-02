/**
 * What we ask a new customer, and why each answer earns its place.
 *
 * Four questions, one screen each. Every one of them does work after signup —
 * an onboarding question whose answer is never used again is a question that
 * only cost you a signup.
 */

export interface ProblemOption {
  id: string;
  label: string;
  /** Agents we surface first when someone picks this. */
  suggests: string[];
}

/** Their answer becomes the sentence the dashboard leads with. */
export const PROBLEMS: ProblemOption[] = [
  {
    id: "too-many-tools",
    label: "I pay for too many tools and use half of them",
    suggests: ["content-agent", "analytics-agent", "newsletter-agent"],
  },
  {
    id: "no-time-marketing",
    label: "Marketing keeps slipping to next week",
    suggests: ["content-agent", "blog-agent", "newsletter-agent"],
  },
  {
    id: "no-leads",
    label: "Not enough people in the pipeline",
    suggests: ["lead-agent", "outreach-agent", "proposal-agent"],
  },
  {
    id: "support-piling-up",
    label: "Support and reviews pile up on me",
    suggests: ["inbox-agent", "review-agent", "docs-agent"],
  },
  {
    id: "no-visibility",
    label: "I do not know what my numbers are doing",
    suggests: ["analytics-agent", "seo-agent", "competitor-agent"],
  },
  {
    id: "doing-it-all",
    label: "I am the whole team and it does not scale",
    suggests: ["content-agent", "lead-agent", "inbox-agent"],
  },
];

export const SPEND_BANDS: { id: string; label: string; midpoint: number }[] = [
  { id: "under-100", label: "Under $100", midpoint: 60 },
  { id: "100-500", label: "$100 – $500", midpoint: 300 },
  { id: "500-1500", label: "$500 – $1,500", midpoint: 1000 },
  { id: "1500-plus", label: "More than $1,500", midpoint: 2500 },
  { id: "no-idea", label: "Honestly, no idea", midpoint: 0 },
];

export function spendBandFor(amount: number | null): string | null {
  if (amount === null) return null;
  const band = SPEND_BANDS.find((b) => b.midpoint === amount);
  return band?.label ?? null;
}

export function problemLabel(id: string): string | undefined {
  return PROBLEMS.find((problem) => problem.id === id)?.label;
}

/**
 * Which agents to put in front of this customer first.
 *
 * Their stated problems drive it, then the tools they told us they pay for.
 * Falls back to nothing rather than a guess — an empty list means the library
 * renders in its normal order, which is a fine outcome.
 */
export function suggestedAgentIds(
  problems: string[],
  currentTools: string[],
  toolToAgent: Map<string, string>,
): string[] {
  const suggestions: string[] = [];

  for (const problem of problems) {
    const option = PROBLEMS.find((p) => p.id === problem);
    for (const agentId of option?.suggests ?? []) {
      if (!suggestions.includes(agentId)) suggestions.push(agentId);
    }
  }

  for (const tool of currentTools) {
    const agentId = toolToAgent.get(tool.toLowerCase());
    if (agentId && !suggestions.includes(agentId)) suggestions.push(agentId);
  }

  return suggestions;
}
