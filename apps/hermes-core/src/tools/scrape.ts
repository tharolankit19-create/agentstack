import { fetchPage, toBrief } from "@/integrations/scraper";
import type { Tool } from "@/core/types";

/**
 * Read a web page.
 *
 * Almost every agent starts here: an agent that writes about a product it has
 * not read writes about a product that does not exist.
 */
export const scrapeTool: Tool = {
  name: "read_page",
  description:
    "Read a web page and return its title, description, headings and text. " +
    "Use this before writing anything about a product, competitor, or article. " +
    "Defaults to the agent's configured website when no url is given.",
  parameters: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description: "Page to read. Omit to read the agent's configured website.",
      },
    },
    required: [],
    additionalProperties: false,
  },
  async run(args, ctx) {
    const url =
      (args.url as string | undefined) ||
      ctx.config.websiteUrl ||
      ctx.config.siteUrl;

    if (!url) {
      throw new Error(
        "No URL to read. Set the website URL in this agent's configuration.",
      );
    }

    const page = await fetchPage(url, ctx.signal);
    ctx.log("page.read", { url: page.url, chars: page.text.length });

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
