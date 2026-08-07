import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Analytics } from "@vercel/analytics/next";
import { SITE } from "@/lib/site";
import { appUrl } from "@/lib/deploy";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl()),
  title: {
    default: `${SITE.name} — ${SITE.tagline}`,
    template: `%s — ${SITE.name}`,
  },
  description: SITE.description,
  applicationName: SITE.name,
  keywords: [
    "AI agents",
    "marketing automation",
    "content agent",
    "review management",
    "lead generation",
  ],
  openGraph: {
    type: "website",
    siteName: SITE.name,
    title: "Cancel your SaaS. Keep the work.",
    description: SITE.description,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "Cancel your SaaS. Keep the work.",
    description: SITE.description,
    creator: SITE.twitterHandle ? `@${SITE.twitterHandle.replace(/^@/, "")}` : undefined,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  /* Matches --bg in each theme, so the browser chrome on mobile is the same
     colour as the page rather than a strip of the wrong one. */
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#08090d" },
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
  ],
  width: "device-width",
  initialScale: 1,
};

/**
 * Runs before first paint, so a returning customer with the light theme never
 * sees a black flash — and vice versa. It has to be inline and synchronous:
 * anything deferred paints the default theme first, which is the flash.
 *
 * A stored choice wins. No stored choice means "follow the OS", which the
 * stylesheet already handles, so the attribute is left off entirely.
 */
const NO_FLASH = `
try {
  var t = localStorage.getItem('agentstack-theme');
  if (t === 'dark' || t === 'light') document.documentElement.dataset.theme = t;
} catch (e) {}
`.trim();

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH }} />
      </head>
      <body className="min-h-dvh antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
