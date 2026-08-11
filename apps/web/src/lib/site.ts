/**
 * Everything about the product that is not code.
 *
 * Set these once. `NEXT_PUBLIC_TWITTER_HANDLE` and `NEXT_PUBLIC_FOUNDER_NAME`
 * belong to whoever is selling this — fill them in before launch, because a
 * founder people can see and hear outsells a faceless brand every time.
 */

export const SITE = {
  name: "Marketing Agents Army",
  short: "MAA",
  /** Under 10 words, on purpose. */
  tagline: "Your marketing team works while you sleep.",
  description:
    "Six squads of marketing agents — research, content, competitor intel, " +
    "trends, cold outreach, reputation — running on your own infrastructure " +
    "and your own model key. One head agent reads what they did and messages " +
    "you the plan on Telegram every morning. You reply 1 to approve. Nothing " +
    "posts, sends or spends without you. From $29/month.",
  founder: process.env.NEXT_PUBLIC_FOUNDER_NAME || "the founder",
  twitterHandle: process.env.NEXT_PUBLIC_TWITTER_HANDLE || "",
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "",
} as const;

export function twitterUrl(): string | null {
  const handle = SITE.twitterHandle.replace(/^@/, "");
  return handle ? `https://x.com/${handle}` : null;
}
