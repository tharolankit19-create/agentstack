import { scrapeTool } from "./scrape";
import { apiRequestTool } from "./api-request";
import { draftTool, listPromptsTool } from "./draft";
import { publishTool, sendEmailTool, notifyTool } from "./publish";
import { findLeadsTool } from "./leads";
import { checkReviewsTool } from "./reviews";
import { rememberTool, proposePromptChangeTool } from "./learn";
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
  remember: rememberTool,
  propose_prompt_change: proposePromptChangeTool,
};

/**
 * Tools every agent gets whether its template asks for them or not.
 *
 * `remember` is here rather than in each template's tool list because an agent
 * that cannot write down what it learned is an agent that starts from nothing
 * every morning — and that would have meant editing fourteen config files to
 * turn the feature on, then editing every future one to remember to include
 * it. Capability that must be universal should not be opt-in.
 */
export const ALWAYS_ON = [rememberTool, proposePromptChangeTool];

export const TOOL_NAMES = Object.keys(TOOLS);

export function resolveTools(templateId: string, names: string[]): Tool[] {
  const asked = names.map((name) => {
    const tool = TOOLS[name];
    if (!tool) {
      throw new Error(
        `Template "${templateId}" asks for tool "${name}", which is not registered. ` +
          `Available: ${TOOL_NAMES.join(", ")}.`,
      );
    }
    return tool;
  });

  // Append the always-on ones, without duplicating any a template listed
  // explicitly — the model sees each tool schema once or it gets confused
  // about which of two identical tools to call.
  const seen = new Set(asked.map((tool) => tool.name));
  return [...asked, ...ALWAYS_ON.filter((tool) => !seen.has(tool.name))];
}
