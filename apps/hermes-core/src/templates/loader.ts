import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { resolveTools } from "@/tools";
import { isCustomTemplate, loadCustomTemplate } from "./custom";
import type { LoadedTemplate, TemplateConfig } from "@/core/types";

/**
 * Loads the one template this deployment runs.
 *
 * A deployed agent is single-purpose: AgentStack sets `ACTIVE_TEMPLATE` at
 * deploy time and the loader reads that folder's config + prompts from disk.
 * Prompts stay as plain `.txt` on purpose — a customer on the plan that
 * includes prompt editing can change their agent's voice without touching
 * TypeScript.
 */

const TEMPLATES_DIR = path.join(process.cwd(), "templates");

let cache: LoadedTemplate | null = null;

export function activeTemplateId(): string {
  const id = process.env.ACTIVE_TEMPLATE?.trim();
  if (!id) throw new Error("ACTIVE_TEMPLATE is not set on this deployment.");
  return id;
}

export async function loadTemplate(templateId?: string): Promise<LoadedTemplate> {
  const id = templateId ?? activeTemplateId();
  if (cache && cache.config.id === id) return cache;

  const loaded = isCustomTemplate(id) ? loadCustomTemplate() : await loadFromDisk(id);
  cache = loaded;
  return loaded;
}

async function loadFromDisk(id: string): Promise<LoadedTemplate> {
  const config = await readConfig(id);
  const prompts = await readPrompts(id, config.prompts);
  const tools = resolveTools(id, config.tools);
  return { config, prompts, tools };
}

async function readConfig(id: string): Promise<TemplateConfig> {
  const file = path.join(TEMPLATES_DIR, id, "config.json");
  let raw: string;
  try {
    raw = await readFile(file, "utf8");
  } catch {
    const known = await listTemplateIds();
    throw new Error(
      `Template "${id}" has no config.json. Known templates: ${known.join(", ")}.`,
    );
  }

  const config = JSON.parse(raw) as TemplateConfig;
  if (config.id !== id) {
    throw new Error(`Template folder "${id}" declares id "${config.id}". They must match.`);
  }
  return config;
}

async function readPrompts(
  id: string,
  names: string[],
): Promise<Record<string, string>> {
  const entries = await Promise.all(
    names.map(async (name) => {
      const file = path.join(TEMPLATES_DIR, id, "prompts", `${name}.txt`);
      try {
        return [name, (await readFile(file, "utf8")).trim()] as const;
      } catch {
        throw new Error(`Template "${id}" is missing prompts/${name}.txt.`);
      }
    }),
  );
  return Object.fromEntries(entries);
}

export async function listTemplateIds(): Promise<string[]> {
  try {
    const entries = await readdir(TEMPLATES_DIR, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

/** Test/tooling escape hatch. */
export function clearTemplateCache(): void {
  cache = null;
}
