import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import { SITE } from "@/lib/site";
import "./globals.css";
import "./kryx.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: `${SITE.name} — ${SITE.tagline}`, template: `%s — ${SITE.name}` },
  description: SITE.description,
  applicationName: SITE.name,
  keywords: ["AI head of marketing", "AI CMO", "AI marketing agents", "AI marketing team", "autonomous marketing agents", "AI SEO agent", "AI lead generation agent", "founder marketing automation"],
  alternates: { canonical: "/" },
  openGraph: { type: "website", siteName: SITE.name, title: `${SITE.name} — Finished marketing work, ready for approval`, description: SITE.description, url: "/" },
  twitter: { card: "summary_large_image", title: `${SITE.name} — Finished marketing work, ready for approval`, description: SITE.description, creator: SITE.twitterHandle ? `@${SITE.twitterHandle.replace(/^@/, "")}` : undefined },
  robots: { index: true, follow: true },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: "/icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0b0a09" },
    { media: "(prefers-color-scheme: light)", color: "#fbf9f5" },
  ],
  width: "device-width",
  initialScale: 1,
};

const NO_FLASH = `
try {
  var t = localStorage.getItem('kryxai-theme') || localStorage.getItem('agentstack-theme');
  if (t === 'dark' || t === 'light') document.documentElement.dataset.theme = t;
} catch (e) {}
document.documentElement.classList.add('js');
`.trim();

const PLAUSIBLE_INIT = `
window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)},plausible.init=plausible.init||function(i){plausible.o=i||{}};
plausible.init();
`.trim();

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH }} />
        <Script
          src="https://plausible.io/js/pa-IToCqdku8bp7LkDzWGOcF.js"
          strategy="afterInteractive"
        />
        <Script id="plausible-init" strategy="afterInteractive">
          {PLAUSIBLE_INIT}
        </Script>
      </head>
      <body className="min-h-dvh antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
