/** Public product identity. Keep brand/domain here so metadata and UI stay consistent. */
export const SITE = {
  name: "KryxAI",
  short: "Kryx",
  tagline: "Wake up to finished marketing work.",
  description:
    "Give Kryx one goal. It researches the market, finds leads, prepares the work and asks for your approval.",
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
