export type Lane = "needs_you" | "in_flight" | "queued" | "done";

export type MissionKind = "draft" | "outreach" | "task" | "working";

export interface Mission {
  id: string;
  lane: Lane;
  kind: MissionKind;
  title: string;
  detail: string | null;
  agentName: string | null;
  agentTemplateId: string | null;
  href: string;
  at: string;
  asks: "approval" | "decision" | null;
}

export const LANES: { id: Lane; name: string; blurb: string }[] = [
  { id: "needs_you", name: "Needs you", blurb: "Nothing behind these moves until you answer" },
  { id: "in_flight", name: "In flight", blurb: "An agent is on it right now" },
  { id: "queued", name: "Queued", blurb: "Scheduled, not started" },
  { id: "done", name: "Done today", blurb: "Finished since midnight" },
];

export function inLane(missions: Mission[], lane: Lane, limit = 25): Mission[] {
  return missions.filter((mission) => mission.lane === lane).slice(0, limit);
}

export function needsYouCount(missions: Mission[]): number {
  return missions.filter((mission) => mission.lane === "needs_you").length;
}
