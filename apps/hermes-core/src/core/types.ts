/**
 * Shared vocabulary for the agent engine.
 *
 * The design follows two rules borrowed from the Hermes agent:
 *   1. The core is a narrow waist — capability lives in templates and tools,
 *      not in the loop. Adding an agent must never mean editing `agent.ts`.
 *   2. The prompt prefix is stable. System prompt and tool schemas are built
 *      once per run and never mutated mid-conversation, so provider-side
 *      prompt caching survives a long conversation.
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

export interface ToolResult {
  tool_call_id: string;
  name: string;
  ok: boolean;
  /** Model-visible payload. Always a string — never raw secrets. */
  content: string;
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
  /** Emits a durable artifact (a tweet draft, a review reply, a lead). */
  emit: (generation: Generation) => void;
  signal?: AbortSignal;
}

export interface Tool {
  name: string;
  description: string;
  parameters: ToolParameterSchema;
  /** Tools return model-visible text. Throwing is fine — the loop reports it. */
  run: (args: Record<string, unknown>, ctx: ToolContext) => Promise<string>;
}

export type SecretName =
  | "OPENAI_API_KEY"
  | "TWITTER_API_KEY"
  | "TWITTER_API_SECRET"
  | "TWITTER_ACCESS_TOKEN"
  | "TWITTER_ACCESS_SECRET"
  | "LINKEDIN_ACCESS_TOKEN"
  | "LINKEDIN_AUTHOR_URN"
  | "APOLLO_API_KEY";

export type GenerationKind =
  | "tweet"
  | "linkedin"
  | "review_reply"
  | "lead"
  | "note";

export interface Generation {
  kind: GenerationKind;
  content: string;
  meta?: Record<string, unknown>;
}

export interface TemplateConfig {
  id: string;
  name: string;
  description: string;
  /** Human-facing "this replaces X" line, used by the dashboard card. */
  replaces: string[];
  /** Cron expression the scheduler uses when the agent runs unattended. */
  frequency: string;
  model: string;
  temperature: number;
  maxIterations: number;
  /** Tool names, resolved against the template's tool registry entry. */
  tools: string[];
  /** Non-secret settings the founder fills in, e.g. websiteUrl, tone. */
  settings: TemplateSettingSpec[];
  /** Secrets the founder supplies. Stored encrypted, injected as env. */
  secrets: TemplateSecretSpec[];
  /** Named prompt files under prompts/, without the .txt extension. */
  prompts: string[];
  /** The task handed to the agent when a scheduled run fires. */
  scheduledTask: string;
}

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

/** Values the founder supplied for `TemplateConfig.settings`. */
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
