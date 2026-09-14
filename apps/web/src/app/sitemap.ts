import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";
import { REPLACEABLES } from "@/lib/replaceability";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = SITE.url;
  const now = new Date();
  const seoPages = ["/ai-marketing-agents", "/ai-marketing-team", "/ai-seo-agent", "/ai-lead-generation-agent"];
  const productPages = ["/demo", "/pricing", "/security", "/privacy", "/terms"];

  return [
    { url: base, lastModified: now, changeFrequency: "weekly", priority: 1 },
    ...productPages.map((path) => ({
      url: `${base}${path}`,
      lastModified: now,
      changeFrequency: path === "/demo" || path === "/pricing" ? "weekly" as const : "yearly" as const,
      priority: path === "/demo" || path === "/pricing" ? 0.85 : 0.3,
    })),
    ...seoPages.map((path) => ({ url: `${base}${path}`, lastModified: now, changeFrequency: "weekly" as const, priority: 0.9 })),
    { url: `${base}/replace`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    ...REPLACEABLES.map((entry) => ({ url: `${base}/replace/${entry.slug}`, lastModified: now, changeFrequency: "monthly" as const, priority: 0.7 })),
  ];
}
