import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";
import { REPLACEABLES } from "@/lib/replaceability";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = SITE.url;
  const now = new Date();
  const seoPages = [
    "/ai-marketing-agents",
    "/ai-marketing-team",
    "/ai-seo-agent",
    "/ai-lead-generation-agent",
    "/ai-cmo-for-startups",
    "/ai-competitor-research-agent",
    "/ai-content-marketing-agent",
    "/saas-marketing-automation",
  ];

  return [
    { url: base, lastModified: now, changeFrequency: "weekly", priority: 1 },
    ...seoPages.map((path) => ({
      url: `${base}${path}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.9,
    })),
    {
      url: `${base}/replace`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    ...REPLACEABLES.map((entry) => ({
      url: `${base}/replace/${entry.slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    {
      url: `${base}/pricing`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    { url: `${base}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    {
      url: `${base}/privacy`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.2,
    },
    {
      url: `${base}/security`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.4,
    },
  ];
}
