/**
 * The shape of a research step — types only, safe on both sides.
 *
 * Split from `research.ts` for the same reason the board's types were split
 * from `missions.ts`: the trail is rendered in the browser and that module
 * imports Firecrawl and the service-role client. A type import is erased at
 * compile time, but only if it is a type import from a module the bundler is
 * willing to follow, and `server-only` exists precisely to make it unwilling.
 */

export interface ResearchStep {
  kind: "page" | "search" | "social";
  /** What the founder reads: "competitor.com" or the search phrase. */
  label: string;
  url?: string;
  /** False when the fetch failed — shown as tried-and-blocked, never hidden. */
  ok: boolean;
}
