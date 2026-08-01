import templatesJson from "@/generated/templates.json";

/**
 * The agent catalog.
 *
 * Generated from apps/hermes-core/templates/*\/config.json by
 * scripts/build-runtime-bundle.mjs, so the form a customer fills in and the
 * config the deployed agent reads can never drift apart.
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

export interface AgentTemplate {
  id: string;
  name: string;
  description: string;
  replaces: string[];
  frequency: string;
  model: string;
  temperature: number;
  maxIterations: number;
  tools: string[];
  prompts: string[];
  scheduledTask: string;
  settings: TemplateSettingSpec[];
  secrets: TemplateSecretSpec[];
}

export const TEMPLATES = templatesJson as unknown as AgentTemplate[];

export function getTemplate(id: string): AgentTemplate | undefined {
  return TEMPLATES.find((template) => template.id === id);
}

export function requireTemplate(id: string): AgentTemplate {
  const template = getTemplate(id);
  if (!template) {
    throw new Error(
      `Unknown agent template "${id}". Known: ${TEMPLATES.map((t) => t.id).join(", ")}.`,
    );
  }
  return template;
}

/** Display metadata that belongs to the marketing surface, not the engine. */
export const TEMPLATE_PRESENTATION: Record<
  string,
  { emoji: string; headline: string; proof: string }
> = {
  "content-agent": {
    emoji: "✍️",
    headline: "5 tweets and 2 LinkedIn posts. Every weekday. 9am.",
    proof: "Reads your site first, so it writes about your product, not a generic one.",
  },
  "review-agent": {
    emoji: "⭐",
    headline: "Every new review gets a reply before you wake up.",
    proof: "Checks G2, Capterra and Trustpilot every 6 hours. Flags the 1-stars for you.",
  },
  "lead-agent": {
    emoji: "🎯",
    headline: "25 people who match your ICP, with the first line written.",
    proof: "Pulls from Apollo, ranks by fit, and never invents a fact about anyone.",
  },
};

export function presentationFor(id: string) {
  return (
    TEMPLATE_PRESENTATION[id] ?? {
      emoji: "🤖",
      headline: "",
      proof: "",
    }
  );
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
  template: AgentTemplate,
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
