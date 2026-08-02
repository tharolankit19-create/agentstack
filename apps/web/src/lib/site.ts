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
  tagline: "Cancel your SaaS. Keep the work.",
  description:
    "You pay twelve companies to do twelve jobs. AgentStack gives you an agent " +
    "for each one — already built, already knows the job. Live on its own URL in " +
    "90 seconds. From $29/month, and you can paste in any tool we have not " +
    "covered yet.",
  founder: process.env.NEXT_PUBLIC_FOUNDER_NAME || "the founder",
  twitterHandle: process.env.NEXT_PUBLIC_TWITTER_HANDLE || "",
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "",
} as const;

export function twitterUrl(): string | null {
  const handle = SITE.twitterHandle.replace(/^@/, "");
  return handle ? `https://x.com/${handle}` : null;
}
