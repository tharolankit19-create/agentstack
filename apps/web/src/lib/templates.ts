import templatesJson from "@/generated/templates.json";

/**
 * The agent catalog.
 *
 * Generated from apps/hermes-core/templates/*\/config.json by
 * scripts/build-runtime-bundle.mjs, so the form a customer fills in, the price
 * the landing page claims they save, and the config the deployed agent reads
 * can never drift apart.
 */

export interface TemplateSettingSpec {
  key: string;
  label: string;
  type: "text" | "url" | "textarea" | "select";
  placeholder?: string;
  help?: string;
  required?: boolean;
  options?: string[];
  default?: string;
}

export interface TemplateSecretSpec {
  key: string;
  label: string;
  help?: string;
  required?: boolean;
}

export type TemplateCategory =
  | "Content"
  | "Sales"
  | "Support"
  | "Marketing"
  | "Operations"
  | "Custom";

export interface AgentTemplate {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  icon: string;
  replaces: { tools: string[]; monthlyUsd: number };
  frequency: string;
  model: string;
  temperature: number;
  maxIterations: number;
  tools: string[];
  prompts: string[];
  scheduledTask: string;
  examples?: string[];
  settings: TemplateSettingSpec[];
  secrets: TemplateSecretSpec[];
}

export const TEMPLATES = templatesJson as unknown as AgentTemplate[];

export const CATEGORIES: TemplateCategory[] = [
  "Content",
  "Sales",
  "Support",
  "Marketing",
  "Operations",
];

/** What a customer stops paying for if they replace everything in the catalog. */
export const TOTAL_MONTHLY_REPLACED = TEMPLATES.reduce(
  (sum, template) => sum + template.replaces.monthlyUsd,
  0,
);

/** Every product name in the catalog, for the "cancel these" list. */
export const REPLACED_TOOLS = [
  ...new Set(TEMPLATES.flatMap((template) => template.replaces.tools)),
].sort();

export function getTemplate(id: string): AgentTemplate | undefined {
  return TEMPLATES.find((template) => template.id === id);
}

export function requireTemplate(id: string): AgentTemplate {
  const template = getTemplate(id);
  if (!template) {
    throw new Error(
      `Unknown agent "${id}". Known: ${TEMPLATES.map((t) => t.id).join(", ")}.`,
    );
  }
  return template;
}

export function templatesByCategory(): { category: TemplateCategory; templates: AgentTemplate[] }[] {
  return CATEGORIES.map((category) => ({
    category,
    templates: TEMPLATES.filter((template) => template.category === category),
  })).filter((group) => group.templates.length > 0);
}

export function monthlySavings(templateIds: string[]): number {
  return templateIds.reduce((sum, id) => {
    const template = getTemplate(id);
    return sum + (template?.replaces.monthlyUsd ?? 0);
  }, 0);
}

export function formatUsd(amount: number): string {
  return `$${amount.toLocaleString("en-US")}`;
}

/** Validates a settings payload against the template's declared fields. */
export function validateSettings(
  template: AgentTemplate,
  input: Record<string, unknown>,
): { ok: true; values: Record<string, string> } | { ok: false; errors: string[] } {
  const values: Record<string, string> = {};
  const errors: string[] = [];

  for (const spec of template.settings) {
    const raw = input[spec.key];
    const value = raw === undefined || raw === null ? "" : String(raw).trim();

    if (!value) {
      if (spec.required) errors.push(`${spec.label} is required.`);
      continue;
    }
    if (value.length > 4_000) {
      errors.push(`${spec.label} is too long (max 4000 characters).`);
      continue;
    }
    if (spec.type === "url" && !/^https?:\/\/[^\s]+\.[^\s]+/i.test(value)) {
      errors.push(`${spec.label} must be a full URL, like https://example.com.`);
      continue;
    }
    if (spec.type === "select" && spec.options && !spec.options.includes(value)) {
      errors.push(`${spec.label} must be one of: ${spec.options.join(", ")}.`);
      continue;
    }
    values[spec.key] = value;
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, values };
}

/** Validates supplied secrets. Values are checked for shape only, never logged. */
export function validateSecrets(
  template: Pick<AgentTemplate, "secrets">,
  input: Record<string, unknown>,
  existingKeys: string[] = [],
): { ok: true; values: Record<string, string> } | { ok: false; errors: string[] } {
  const values: Record<string, string> = {};
  const errors: string[] = [];
  const allowed = new Set(template.secrets.map((s) => s.key));

  for (const [key, raw] of Object.entries(input)) {
    if (!allowed.has(key)) continue;
    const value = raw === undefined || raw === null ? "" : String(raw).trim();
    if (!value) continue;
    if (value.length > 500) {
      errors.push(`${key} looks too long to be an API key.`);
      continue;
    }
    values[key] = value;
  }

  for (const spec of template.secrets) {
    if (spec.required && !values[spec.key] && !existingKeys.includes(spec.key)) {
      errors.push(`${spec.label} is required.`);
    }
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, values };
}
