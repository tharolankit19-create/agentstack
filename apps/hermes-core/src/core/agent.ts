import { randomUUID } from "node:crypto";
import { Memory } from "./memory";
import { RunLogger } from "./logger";
import { getSecret, redact } from "./secrets";
import { loadTemplate } from "@/templates/loader";
import { complete } from "@/integrations/openai";
import type {
  Generation,
  LoadedTemplate,
  Message,
  RunRequest,
  RunResult,
  Tool,
  ToolCall,
  ToolContext,
  TemplateRuntimeConfig,
} from "./types";

/**
 * The agent loop.
 *
 * Deliberately boring: load a template, build a stable prompt, call the model,
 * run whatever tools it asks for, repeat until it stops asking. Every agent in
 * AgentStack is this same loop with a different template — the loop has no
 * knowledge of tweets, reviews, or leads.
 */

const DEFAULT_MAX_ITERATIONS = 8;

export async function runAgent(request: RunRequest): Promise<RunResult> {
  const runId = randomUUID();
  const startedAt = new Date().toISOString();
  const log = new RunLogger(runId);
  const trigger = request.trigger ?? "manual";

  const template = await loadTemplate();
  const config = resolveSettings(template, request.settings);
  const maxIterations =
    request.maxIterations ??
    template.config.maxIterations ??
    DEFAULT_MAX_ITERATIONS;

  const generations: Generation[] = [];
  const memory = new Memory(buildSystemPrompt(template, config));
  if (request.history?.length) memory.hydrate(request.history);
  memory.push({ role: "user", content: request.task });

  const ctx: ToolContext = {
    config,
    secret: getSecret,
    log: (event, data) => log.log(event, data),
    emit: (generation) => {
      generations.push(generation);
      log.log("generation", { kind: generation.kind });
    },
  };

  const usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  let iterations = 0;
  let toolCalls = 0;
  let output = "";
  let error: string | undefined;

  log.log("run.start", {
    template: template.config.id,
    trigger,
    tools: template.tools.map((t) => t.name),
  });

  try {
    while (iterations < maxIterations) {
      iterations += 1;

      const completion = await complete({
        model: process.env.AGENT_MODEL || template.config.model,
        temperature: template.config.temperature,
        messages: memory.render(),
        tools: template.tools,
      });

      usage.promptTokens += completion.usage.promptTokens;
      usage.completionTokens += completion.usage.completionTokens;
      usage.totalTokens += completion.usage.totalTokens;

      memory.push({
        role: "assistant",
        content: completion.content,
        tool_calls: completion.toolCalls.length ? completion.toolCalls : undefined,
      });

      if (completion.content) output = completion.content;

      if (completion.toolCalls.length === 0) {
        log.log("run.complete", { iterations, finishReason: completion.finishReason });
        break;
      }

      // Tools within one turn are independent, so they run together.
      const results = await Promise.all(
        completion.toolCalls.map((call) => executeTool(call, template.tools, ctx, log)),
      );
      toolCalls += results.length;
      memory.pushAll(results);

      if (iterations === maxIterations) {
        log.log("run.iteration_budget_exhausted", { maxIterations });
        // Give the model one last turn to answer with what it has.
        memory.push({
          role: "user",
          content:
            "You have reached the tool budget for this run. Reply now with your " +
            "final answer using only what you already gathered. Do not call tools.",
        });
        const final = await complete({
          model: process.env.AGENT_MODEL || template.config.model,
          temperature: template.config.temperature,
          messages: memory.render(),
        });
        usage.totalTokens += final.usage.totalTokens;
        usage.promptTokens += final.usage.promptTokens;
        usage.completionTokens += final.usage.completionTokens;
        output = final.content || output;
        memory.push({ role: "assistant", content: output });
      }
    }
  } catch (cause) {
    error = redact(cause instanceof Error ? cause.message : String(cause));
    log.log("run.error", { error });
  }

  const finishedAt = new Date().toISOString();
  return {
    ok: !error,
    runId,
    templateId: template.config.id,
    trigger,
    output: redact(output),
    generations,
    messages: memory.history(),
    iterations,
    toolCalls,
    usage,
    startedAt,
    finishedAt,
    error,
  };
}

async function executeTool(
  call: ToolCall,
  tools: Tool[],
  ctx: ToolContext,
  log: RunLogger,
): Promise<Message> {
  const tool = tools.find((t) => t.name === call.name);
  const base = { role: "tool" as const, tool_call_id: call.id, name: call.name };

  if (!tool) {
    log.log("tool.unknown", { name: call.name });
    return {
      ...base,
      content: `Error: no tool named "${call.name}" is available to this agent.`,
    };
  }

  log.log("tool.start", { name: call.name, args: call.arguments });
  const startedAt = Date.now();
  try {
    const result = await tool.run(call.arguments ?? {}, ctx);
    log.log("tool.ok", { name: call.name, ms: Date.now() - startedAt });
    return { ...base, content: redact(truncate(result)) };
  } catch (cause) {
    const message = redact(cause instanceof Error ? cause.message : String(cause));
    log.log("tool.error", { name: call.name, error: message });
    // Failures go back to the model as text, not exceptions: the agent can
    // usually route around a dead API, and a crashed run helps nobody.
    return { ...base, content: `Error running ${call.name}: ${message}` };
  }
}

function buildSystemPrompt(
  template: LoadedTemplate,
  config: TemplateRuntimeConfig,
): string {
  const system = template.prompts.system ?? "You are a helpful assistant.";
  const settings = Object.entries(config)
    .filter(([, value]) => value)
    .map(([key, value]) => `- ${key}: ${value}`)
    .join("\n");

  return [
    render(system, config),
    settings ? `\n## This agent's configuration\n${settings}` : "",
    `\n## Today\n${new Date().toISOString().slice(0, 10)}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function resolveSettings(
  template: LoadedTemplate,
  overrides: TemplateRuntimeConfig = {},
): TemplateRuntimeConfig {
  const resolved: TemplateRuntimeConfig = {};
  for (const spec of template.config.settings) {
    const value =
      overrides[spec.key] ??
      process.env[`SETTING_${toEnvKey(spec.key)}`] ??
      spec.default ??
      "";
    if (value) resolved[spec.key] = value;
  }
  return resolved;
}

/** `{{key}}` substitution — the only templating the prompts get. */
export function render(text: string, values: Record<string, string>): string {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) =>
    values[key] !== undefined ? values[key] : match,
  );
}

function toEnvKey(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toUpperCase();
}

function truncate(text: string, limit = 12_000): string {
  return text.length <= limit
    ? text
    : `${text.slice(0, limit)}\n\n[truncated ${text.length - limit} characters]`;
}
