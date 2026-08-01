import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
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
    title: "Your marketing team costs $2,000 a month. This costs $29.",
    description: SITE.description,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "Your marketing team costs $2,000 a month. This costs $29.",
    description: SITE.description,
    creator: SITE.twitterHandle ? `@${SITE.twitterHandle.replace(/^@/, "")}` : undefined,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
