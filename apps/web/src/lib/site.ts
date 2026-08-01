/**
 * Everything about the product that is not code.
 *
 * Set these once. `NEXT_PUBLIC_TWITTER_HANDLE` and `NEXT_PUBLIC_FOUNDER_NAME`
 * belong to whoever is selling this — fill them in before launch, because a
 * founder people can see and hear outsells a faceless brand every time.
 */

export const SITE = {
  name: "AgentStack",
  /** Under 10 words, on purpose. */
  tagline: "Three AI marketing agents. Deployed in 90 seconds.",
  description:
    "Your marketing team costs $2,000 a month. AgentStack costs $29, once. " +
    "Three agents that write your posts, answer your reviews, and find your leads — " +
    "live on your own URL in 90 seconds.",
  founder: process.env.NEXT_PUBLIC_FOUNDER_NAME || "the founder",
  twitterHandle: process.env.NEXT_PUBLIC_TWITTER_HANDLE || "",
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "",
} as const;

export function twitterUrl(): string | null {
  const handle = SITE.twitterHandle.replace(/^@/, "");
  return handle ? `https://x.com/${handle}` : null;
}
