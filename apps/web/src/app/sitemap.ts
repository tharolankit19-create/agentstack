import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/deploy";
import { REPLACEABLES } from "@/lib/replaceability";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = appUrl();
  const now = new Date();

  return [
    { url: base, lastModified: now, changeFrequency: "weekly", priority: 1 },
    {
      url: `${base}/replace`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    // One entry per tool. These are the pages people actually search for —
    // "buffer alternative" long before "ai agent platform".
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
  ];
}
