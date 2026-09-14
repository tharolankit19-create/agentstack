/** Public product identity. Keep brand/domain here so metadata and UI stay consistent. */
export const SITE = {
  name: "KryxAI",
  short: "Kryx",
  tagline: "Your AI Head of Marketing.",
  description:
    "KryxAI gives founders an AI Head of Marketing that coordinates research, content, SEO, conversion and pipeline agents, keeps approvals with the founder for consequential actions, and charges only when specialist work gets done.",
  domain: "getkryxai.com",
  url: "https://getkryxai.com",
  founder: process.env.NEXT_PUBLIC_FOUNDER_NAME || "the founder",
  twitterHandle: process.env.NEXT_PUBLIC_TWITTER_HANDLE || "",
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "",
} as const;

export function twitterUrl(): string | null {
  const handle = SITE.twitterHandle.replace(/^@/, "");
  return handle ? `https://x.com/${handle}` : null;
}
