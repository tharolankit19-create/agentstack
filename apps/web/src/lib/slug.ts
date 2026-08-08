/**
 * Product name → URL slug.
 *
 * Lives on its own so client code can slug a tool name without pulling in the
 * 860-entry directory that replaceability.ts imports. The generator in
 * scripts/build-tool-domains.mjs carries a copy of this rule — if you change
 * it here, change it there.
 */
export function toSlug(tool: string): string {
  return tool
    .toLowerCase()
    .replace(/\.[a-z]+$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
