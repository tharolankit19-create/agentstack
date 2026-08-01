import type { Tool } from "@/core/types";

import { scraperTool } from "@templates/content-agent/tools/scraper";
import { publisherTool } from "@templates/content-agent/tools/publisher";
import { monitorTool } from "@templates/review-agent/tools/monitor";
import { drafterTool } from "@templates/review-agent/tools/drafter";
import { prospectorTool } from "@templates/lead-agent/tools/prospector";
import { outreachTool } from "@templates/lead-agent/tools/outreach";

/**
 * Tool implementations live inside their template folder, next to the prompts
 * that use them. They are wired up here with static imports so the bundler can
 * see them — a serverless build cannot `import()` a path it only learns at
 * runtime, and silently shipping a function with no tools is worse than a
 * slightly less magical registry.
 *
 * Adding a template means adding one entry here and one folder. Nothing in
 * `src/core` changes.
 */
export const TOOL_REGISTRY: Record<string, Record<string, Tool>> = {
  "content-agent": {
    scraper: scraperTool,
    publisher: publisherTool,
  },
  "review-agent": {
    monitor: monitorTool,
    drafter: drafterTool,
  },
  "lead-agent": {
    prospector: prospectorTool,
    outreach: outreachTool,
  },
};

export const TEMPLATE_IDS = Object.keys(TOOL_REGISTRY);

export function resolveTools(templateId: string, names: string[]): Tool[] {
  const available = TOOL_REGISTRY[templateId];
  if (!available) {
    throw new Error(
      `Unknown template "${templateId}". Known templates: ${TEMPLATE_IDS.join(", ")}.`,
    );
  }
  return names.map((name) => {
    const tool = available[name];
    if (!tool) {
      throw new Error(
        `Template "${templateId}" lists tool "${name}", which is not registered. ` +
          `Available: ${Object.keys(available).join(", ")}.`,
      );
    }
    return tool;
  });
}
