import { readFile } from "node:fs/promises";
import path from "node:path";
import { resolveTools, TEMPLATE_IDS } from "./registry";
import type { LoadedTemplate, TemplateConfig } from "@/core/types";

/**
 * Loads the one template this deployment runs.
 *
 * A deployed agent is single-purpose: AgentStack sets `ACTIVE_TEMPLATE` at
 * deploy time and the loader reads that folder's config + prompts from disk.
 * Prompts stay as plain `.txt` on purpose — a founder can fork the repo and
 * edit their agent's voice without touching TypeScript.
 */

const TEMPLATES_DIR = path.join(process.cwd(), "templates");

let cache: LoadedTemplate | null = null;

export function activeTemplateId(): string {
  const id = process.env.ACTIVE_TEMPLATE?.trim();
  if (!id) {
    throw new Error(
      `ACTIVE_TEMPLATE is not set. Expected one of: ${TEMPLATE_IDS.join(", ")}.`,
    );
  }
  if (!TEMPLATE_IDS.includes(id)) {
    throw new Error(
      `ACTIVE_TEMPLATE="${id}" is not a known template. Expected one of: ${TEMPLATE_IDS.join(", ")}.`,
    );
  }
  return id;
}

export async function loadTemplate(templateId?: string): Promise<LoadedTemplate> {
  const id = templateId ?? activeTemplateId();
  if (cache && cache.config.id === id) return cache;

  const config = await readConfig(id);
  const prompts = await readPrompts(id, config.prompts);
  const tools = resolveTools(id, config.tools);

  const loaded: LoadedTemplate = { config, prompts, tools };
  cache = loaded;
  return loaded;
}

async function readConfig(id: string): Promise<TemplateConfig> {
  const file = path.join(TEMPLATES_DIR, id, "config.json");
  let raw: string;
  try {
    raw = await readFile(file, "utf8");
  } catch {
    throw new Error(`Template "${id}" has no config.json at ${file}.`);
  }

  const config = JSON.parse(raw) as TemplateConfig;
  if (config.id !== id) {
    throw new Error(
      `Template folder "${id}" declares id "${config.id}". They must match.`,
    );
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
        throw new Error(`Template "${id}" is missing prompt file prompts/${name}.txt.`);
      }
    }),
  );
  return Object.fromEntries(entries);
}

/** Test/tooling escape hatch. */
export function clearTemplateCache(): void {
  cache = null;
}
