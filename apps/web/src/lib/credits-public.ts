/**
 * The parts of the credit system a browser may see.
 *
 * `credits.ts` is server-only — it charges accounts and reads the database.
 * The price list and the packs are neither, and the pricing page is a server
 * component that renders into HTML a crawler reads, so they live here where
 * both sides can import them without dragging the admin client into a bundle.
 *
 * One source for the numbers, so the page cannot advertise a price the meter
 * does not charge.
 */

export type Metered =
  | "lead_search"
  | "email_lookup"
  | "web_search"
  | "page_read"
  | "rank_check"
  | "review_check"
  | "social_scan"
  | "draft"
  | "briefing"
  | "email_send";

/** See credits.ts for why each is priced where it is. */
export const COST: Record<Metered, number> = {
  lead_search: 25,
  email_lookup: 12,
  rank_check: 10,
  review_check: 10,
  social_scan: 8,
  web_search: 5,
  page_read: 3,
  draft: 1,
  briefing: 2,
  email_send: 2,
};

export const PACKS = [
  {
    id: "starter",
    credits: 1_000,
    priceUsd: 12,
    label: "Try it properly",
    productId: process.env.NEXT_PUBLIC_DODO_PACK_STARTER,
  },
  {
    id: "working",
    credits: 5_000,
    priceUsd: 49,
    label: "A working month",
    productId: process.env.NEXT_PUBLIC_DODO_PACK_WORKING,
  },
  {
    id: "heavy",
    credits: 20_000,
    priceUsd: 169,
    label: "Launch season",
    productId: process.env.NEXT_PUBLIC_DODO_PACK_HEAVY,
  },
] as const;

export type PackId = (typeof PACKS)[number]["id"];

/** One pack by id, or null. The id comes off a request body, so never trusted. */
export function packById(id: string): (typeof PACKS)[number] | null {
  return PACKS.find((pack) => pack.id === id) ?? null;
}

export function centsPerCredit(pack: (typeof PACKS)[number]): number {
  return (pack.priceUsd * 100) / pack.credits;
}

export function savingPercent(pack: (typeof PACKS)[number]): number {
  const base = centsPerCredit(PACKS[0]);
  return Math.round(((base - centsPerCredit(pack)) / base) * 100);
}

/**
 * Roughly what a pack buys, in the thing founders actually ask for.
 *
 * A range rather than a number, because it depends what they run — a single
 * figure here would be the one claim on the pricing page that turns out to be
 * untrue for most people.
 */
export function packShape(credits: number): string {
  const runs = Math.floor(credits / (COST.lead_search + COST.email_lookup * 3));
  return `${runs.toLocaleString("en-US")} lead searches with enrichment, or months of daily briefings and research`;
}
