import { scrapeTool } from "./scrape";
import { apiRequestTool } from "./api-request";
import { draftTool, listPromptsTool } from "./draft";
import { publishTool, sendEmailTool, notifyTool } from "./publish";
import { findLeadsTool } from "./leads";
import { checkReviewsTool } from "./reviews";
import type { Tool } from "@/core/types";

/**
 * The shared tool registry.
 *
 * Every agent in the catalog is built from these eight primitives. Twelve
 * agents do not mean twelve scrapers — they mean twelve prompt sets pointed at
 * the same tools, which is the only way a catalog this size stays maintainable
 * and the only way a *custom* agent, generated at runtime from a customer's own
 * SaaS, can work at all.
 *
 * Adding a genuinely new capability means adding one entry here. Adding a new
 * agent usually means adding none.
 */
export const TOOLS: Record<string, Tool> = {
  read_page: scrapeTool,
  api_request: apiRequestTool,
  draft: draftTool,
  list_prompts: listPromptsTool,
  queue_post: publishTool,
  send_email: sendEmailTool,
  notify: notifyTool,
  find_leads: findLeadsTool,
  check_reviews: checkReviewsTool,
};

export const TOOL_NAMES = Object.keys(TOOLS);

export function resolveTools(templateId: string, names: string[]): Tool[] {
  return names.map((name) => {
    const tool = TOOLS[name];
    if (!tool) {
      throw new Error(
        `Template "${templateId}" asks for tool "${name}", which is not registered. ` +
          `Available: ${TOOL_NAMES.join(", ")}.`,
      );
    }
    return tool;
  });
}
