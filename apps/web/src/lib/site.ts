/** Public product identity. Keep brand/domain here so metadata and UI stay consistent. */
export const SITE = {
  name: "KryxAI",
  short: "Kryx",
  tagline: "The founder's agent army.",
  description:
    "Give Kryx the job. Its agent army researches, plans and works across the web, your tools and approved devices, then brings back finished work and the decisions that need you.",
  domain: "getkryxai.com",
  url: "https://getkryxai.com",
  founder: process.env.NEXT_PUBLIC_FOUNDER_NAME || "Ankit Tharol",
  twitterHandle: process.env.NEXT_PUBLIC_TWITTER_HANDLE || "ankittharol",
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "",
} as const;

export function twitterUrl(): string | null {
  const handle = SITE.twitterHandle.replace(/^@/, "");
  return handle ? \`https://x.com/\${handle}\` : null;
}
