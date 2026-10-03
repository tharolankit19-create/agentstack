/** Public product identity. Keep brand/domain here so metadata and UI stay consistent. */
export const SITE = {
  name: "KryxAI",
  short: "Kryx",
  tagline: "Your always-on AI marketing operator.",
  description:
    "Tell Kryx the outcome. It plans the work, uses your apps and browser, keeps working in the background, and brings you finished work.",
  domain: "getkryxai.com",
  url: "https://getkryxai.com",
  founder: process.env.NEXT_PUBLIC_FOUNDER_NAME || "Ankit Tharol",
  twitterHandle: process.env.NEXT_PUBLIC_TWITTER_HANDLE || "ankittharol",
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "",
} as const;

export function twitterUrl(): string | null {
  const handle = SITE.twitterHandle.replace(/^@/, "");
  return handle ? `https://x.com/${handle}` : null;
}

