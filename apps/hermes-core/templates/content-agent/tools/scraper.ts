import { fetchPage, toBrief } from "@/integrations/scraper";
import type { Tool } from "@/core/types";

/**
 * Reads a page so the agent writes about the real product instead of a
 * plausible-sounding one.
 */
export const scraperTool: Tool = {
  name: "scrape_website",
  description:
    "Read a web page and return its title, description, headings and text. " +
    "Call this before writing any content so the drafts describe the real product. " +
    "Defaults to the configured website URL when no url is given.",
  parameters: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description:
          "Page to read. Omit to read the agent's configured website URL.",
      },
    },
    required: [],
    additionalProperties: false,
  },
  async run(args, ctx) {
    const url = (args.url as string | undefined) || ctx.config.websiteUrl;
    if (!url) {
      throw new Error(
        "No URL to read. Set the website URL in the agent's configuration.",
      );
    }

    const page = await fetchPage(url, ctx.signal);
    ctx.log("scraped", {
      url: page.url,
      chars: page.text.length,
      headings: page.headings.length,
    });

    if (page.text.length < 200) {
      return (
        `${toBrief(page)}\n\n` +
        "Note: this page returned almost no text — it is probably rendered by " +
        "JavaScript. Try a docs, blog, or pricing page instead."
      );
    }
    return toBrief(page);
  },
};
