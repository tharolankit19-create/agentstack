import domains from "@/generated/tool-domains.json";
import { toSlug } from "./slug";

/**
 * Logos for the agent catalog, safe to import from a client component.
 *
 * The full directory is ~860 entries and the wrong thing to ship to a browser.
 * This is the fifty-odd tools our own agents name, frozen at build time by
 * scripts/build-tool-domains.mjs. Server components should keep using
 * `toolLogos()` in replaceability.ts, which reads the real directory.
 */
const BY_SLUG = domains as Record<string, string>;

export function domainForTool(tool: string): string | undefined {
  return BY_SLUG[toSlug(tool)];
}

/** A tool list turned into what a row of logos needs. */
export function logosForTools(
  tools: string[],
): { tool: string; slug: string; domain?: string }[] {
  return tools.map((tool) => {
    const slug = toSlug(tool);
    return { tool, slug, domain: BY_SLUG[slug] };
  });
}
