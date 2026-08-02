/**
 * Shared vocabulary for the agent engine.
 *
 * Two rules borrowed from the Hermes agent shape everything here:
 *   1. The core is a narrow waist — capability lives in templates and tools,
 *      not in the loop. Adding an agent must never mean editing `agent.ts`.
 *   2. The prompt prefix is stable. System prompt and tool schemas are built
 *      once per run and never mutated mid-conversation, so provider-side
 *      prompt caching survives a long conversation.
 *
 * A third rule arrived with the SaaS-replacement catalog: tools are generic
 * primitives, shared across every template. Twelve agents do not mean twelve
 * scrapers — they mean twelve prompt sets pointed at the same eight tools.
 */

export type Role = "system" | "user" | "assistant" | "tool";

export interface Message {
  role: Role;
  content: string;
  /** Present on assistant messages that requested tools. */
  tool_calls?: ToolCall[];
  /** Present on tool messages, pointing back at the request. */
  tool_call_id?: string;
  name?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

/** JSON Schema subset we hand to the model. */
export interface ToolParameterSchema {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
}

export interface ToolContext {
  /** Resolved, non-secret template configuration. */
  config: TemplateRuntimeConfig;
  /** Secret accessor. Values never enter the transcript. */
  secret: (name: SecretName) => string | undefined;
  /** Structured logger that redacts secrets. */
  log: (event: string, data?: Record<string, unknown>) => void;
  /** Emits a durable artifact (a draft, a reply, a lead, a report). */
  emit: (generation: Generation) => void;
  /** The template this run is executing, for prompt lookups. */
  template: LoadedTemplate;
  signal?: AbortSignal;
}

export interface Tool {
  name: string;
  description: string;
  parameters: ToolParameterSchema;
  /** Tools return model-visible text. Throwing is fine — the loop reports it. */
  run: (args: Record<string, unknown>, ctx: ToolContext) => Promise<string>;
}

/**
 * Secret names are open strings rather than a closed union: a custom agent
 * built from a customer's own SaaS carries credentials this codebase has never
 * heard of. `KNOWN_SECRETS` in secrets.ts still drives redaction.
 */
export type SecretName = string;

export type GenerationKind =
  | "tweet"
  | "linkedin"
  | "email"
  | "review_reply"
  | "lead"
  | "article"
  | "report"
  | "note";

export interface Generation {
  kind: GenerationKind;
  content: string;
  meta?: Record<string, unknown>;
}

/** What this agent lets a customer stop paying for. */
export interface ReplacesSpec {
  /** Product names, e.g. ["Buffer", "Hootsuite"]. */
  tools: string[];
  /** Typical monthly list price of the cheapest realistic paid plan, in USD. */
  monthlyUsd: number;
}

export interface TemplateConfig {
  id: string;
  name: string;
  /** One line, plain language, what it does for you. */
  description: string;
  category: TemplateCategory;
  icon: string;
  replaces: ReplacesSpec;
  /** Cron expression the scheduler uses when the agent runs unattended. */
  frequency: string;
  model: string;
  temperature: number;
  maxIterations: number;
  /** Tool names, resolved against the shared registry in src/tools. */
  tools: string[];
  /** Non-secret settings the customer fills in. */
  settings: TemplateSettingSpec[];
  /** Secrets the customer supplies. Stored encrypted, injected as env. */
  secrets: TemplateSecretSpec[];
  /** Named prompt files under prompts/, without the .txt extension. */
  prompts: string[];
  /** The task handed to the agent when a scheduled run fires. */
  scheduledTask: string;
  /** Starter prompts shown in the chat UI. */
  examples?: string[];
}

export type TemplateCategory =
  | "Content"
  | "Sales"
  | "Support"
  | "Marketing"
  | "Operations"
  | "Custom";

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
  key: SecretName;
  label: string;
  help?: string;
  required?: boolean;
}

/** A loaded template: config + prompt text + resolved tool implementations. */
export interface LoadedTemplate {
  config: TemplateConfig;
  prompts: Record<string, string>;
  tools: Tool[];
}

/** Values the customer supplied for `TemplateConfig.settings`. */
export type TemplateRuntimeConfig = Record<string, string>;

export interface RunRequest {
  /** What the agent should do this run. Free text. */
  task: string;
  /** Prior turns, for chat. Omit for one-shot scheduled runs. */
  history?: Message[];
  /** Overrides for template settings, per-run. */
  settings?: TemplateRuntimeConfig;
  trigger?: "manual" | "schedule" | "chat";
  maxIterations?: number;
}

export interface RunResult {
  ok: boolean;
  runId: string;
  templateId: string;
  trigger: string;
  /** Final assistant text. */
  output: string;
  generations: Generation[];
  messages: Message[];
  iterations: number;
  toolCalls: number;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
  startedAt: string;
  finishedAt: string;
  error?: string;
}

/**
 * A custom agent built by scraping a customer's own SaaS.
 *
 * Generated once by the platform, then handed to the runtime as JSON in
 * `CUSTOM_AGENT_SPEC`. The engine treats it exactly like a built-in template.
 */
export interface CustomAgentSpec {
  id: string;
  name: string;
  description: string;
  replaces: ReplacesSpec;
  systemPrompt: string;
  scheduledTask: string;
  examples: string[];
  /** The API the agent drives, if the customer connected one. */
  api?: {
    baseUrl: string;
    /** How the key is presented. */
    auth: "bearer" | "header" | "query" | "none";
    /** Header or query-parameter name when auth is "header"/"query". */
    authName?: string;
    /** Endpoints the agent is allowed to touch. Empty means any path. */
    endpoints: { method: string; path: string; purpose: string }[];
  };
  /** Documentation pages the generator read, for provenance. */
  sources: string[];
}
