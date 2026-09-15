/** Public product identity. Keep brand/domain here so metadata and UI stay consistent. */
export const SITE = {
  name: "KryxAI",
  short: "Kryx",
  tagline: "Finished marketing work, ready for approval.",
  description:
    "Give Kryx a marketing goal. It coordinates live research, content, SEO, conversion and pipeline work, saves the evidence, and brings back finished work for your approval.",
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
