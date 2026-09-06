/**
 * The shapes the board is made of — types only, plus the two pure helpers that
 * describe its lanes.
 *
 * Split out of `missions.ts` because that module loads the board from four
 * tables and is `server-only`, while the board itself is a client component
 * now that approving happens on the card. Importing `Mission` from there put
 * the admin Supabase client into the browser bundle and failed the build.
 *
 * Nothing here touches a database or a secret, so both sides can import it.
 */

export type Lane = "needs_you" | "in_flight" | "queued" | "done";

/** What the mission is about, which decides how it opens and what it looks like. */
export type MissionKind = "draft" | "outreach" | "task" | "working";

export interface Mission {
  id: string;
  lane: Lane;
  kind: MissionKind;
  title: string;
  /** One line of detail. Never the whole draft — this is a board, not a reader. */
  detail: string | null;
  /** Who is on it, by the name the founder sees. */
  agentName: string | null;
  agentTemplateId: string | null;
  /** Where clicking it goes. */
  href: string;
  at: string;
  /** Set when the founder is what is blocking it, and says what is being asked. */
  asks: "approval" | "decision" | null;
  /**
   * The draft this row is about, when approving it is the whole action.
   *
   * Carried so the board can approve in place. Without it the only thing a card
   * could offer was a link, which is how "needs your approval" ended up
   * navigating to an API-key form.
   */
  generationId?: string;
  /** The agent working it, for the live view. */
  agentId?: string;
}


export const LANES: { id: Lane; name: string; blurb: string }[] = [
  { id: "needs_you", name: "Needs you", blurb: "Nothing behind these moves until you answer" },
  { id: "in_flight", name: "In flight", blurb: "An agent is on it right now" },
  { id: "queued", name: "Queued", blurb: "Scheduled, not started" },
  { id: "done", name: "Done today", blurb: "Finished since midnight" },
];

export function inLane(missions: Mission[], lane: Lane, limit = 25): Mission[] {
  return missions.filter((m) => m.lane === lane).slice(0, limit);
}
