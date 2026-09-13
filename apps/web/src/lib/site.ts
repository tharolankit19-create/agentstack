/** Public product identity. Keep brand/domain here so metadata and UI stay consistent. */
export const SITE = {
  name: "KryxAI",
  short: "Kryx",
  tagline: "Your AI marketing team works while you build.",
  description:
    "KryxAI is an autonomous AI marketing team for founders. Kryx coordinates research, content, SEO, conversion and pipeline agents, keeps approvals with you for consequential actions, and sends short evidence-backed briefs instead of dashboard noise.",
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
