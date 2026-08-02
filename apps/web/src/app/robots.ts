import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/deploy";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Nothing behind the paywall should ever be indexed, and the API is not
      // a page.
      disallow: ["/dashboard", "/api/", "/auth/", "/checkout/"],
    },
    sitemap: `${appUrl()}/sitemap.xml`,
  };
}
