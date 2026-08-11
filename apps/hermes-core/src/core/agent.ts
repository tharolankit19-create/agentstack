import { randomUUID } from "node:crypto";
import { Memory } from "./memory";
import { RunLogger } from "./logger";
import { getSecret, redact } from "./secrets";
import { render, toEnvKey } from "./render";
import { fetchMemory } from "./learning";
import { loadTemplate } from "@/templates/loader";
import { complete } from "@/integrations/openai";
import type {
  Generation,
  Learning,
  LoadedTemplate,
  Message,
  PromptRevision,
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
  const learnings: Learning[] = [];
  let promptRevision: PromptRevision | undefined;

  // What it concluded last time. Fetched before the prompt is built, because
  // it goes into the prompt — and fetched fresh every run rather than baked in
  // at deploy, since an agent runs daily and is redeployed twice a year.
  const recall = await fetchMemory();
  if (recall.brief) log.log("memory.loaded", { chars: recall.brief.length });

  const memory = new Memory(buildSystemPrompt(template, config, recall));
  if (request.history?.length) memory.hydrate(request.history);
  memory.push({ role: "user", content: request.task });

  const ctx: ToolContext = {
    config,
    template,
    secret: getSecret,
    log: (event, data) => log.log(event, data),
    emit: (generation) => {
      generations.push(generation);
      log.log("generation", { kind: generation.kind });
    },
    learn: (learning) => {
      // Same key twice in one run is the model repeating itself, not learning
      // twice. Last one wins — it was written with the most context.
      const existing = learnings.findIndex(
        (entry) => entry.kind === learning.kind && entry.key === learning.key,
      );
      if (existing >= 0) learnings[existing] = learning;
      else learnings.push(learning);
    },
    // One per run. A model that proposes four rewrites of its own instructions
    // in a single run is thrashing, and the last one is no better than the
    // first — but it is at least the one it settled on.
    revise: (revision) => {
      promptRevision = revision;
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
    learnings,
    promptRevision,
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

/**
 * The system prompt: instructions, then memory, then configuration.
 *
 * Memory sits above the settings and below the instructions on purpose. It is
 * evidence, not orders — an agent that treats "this hook failed twice" as
 * outranking its actual brief will drift somewhere nobody asked it to go — but
 * it has to arrive before the model starts reasoning about the task or it may
 * as well not be there.
 *
 * An approved rewrite replaces the template's own text entirely. It is a
 * replacement rather than an append because the founder approved *that* text,
 * and quietly concatenating it onto instructions they thought it replaced
 * would produce a prompt neither of them wrote.
 */
function buildSystemPrompt(
  template: LoadedTemplate,
  config: TemplateRuntimeConfig,
  recall: { brief: string; prompts: Record<string, { body: string }> } = {
    brief: "",
    prompts: {},
  },
): string {
  const system =
    recall.prompts.system?.body ??
    template.prompts.system ??
    "You are a helpful assistant.";

  const settings = Object.entries(config)
    .filter(([, value]) => value)
    .map(([key, value]) => `- ${key}: ${value}`)
    .join("\n");

  return [
    render(system, config),
    recall.brief ? `\n## ${recall.brief}` : "",
    settings ? `\n## This agent's configuration\n${settings}` : "",
    `\n## Today\n${new Date().toISOString().slice(0, 10)}`,
    STANDING_ORDERS,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * The instruction that turns a tool into a habit.
 *
 * `remember` is available to every agent, but a tool nothing tells the model to
 * use is a tool it uses once a fortnight. Putting this in the loop rather than
 * in fourteen template files means the behaviour is uniform and stays uniform —
 * and that a fifteenth agent added next month gets it without anyone
 * remembering to paste it in.
 *
 * It is deliberately short and deliberately last. It is a standing order, not
 * the brief, and it must not out-argue the actual instructions above it.
 */
const STANDING_ORDERS = `
## Standing orders

Before you finish, call \`remember\` for anything you worked out this run that
a future run should not have to work out again — what got a result, what did
not, something true about this business's audience or competitors, or how this
founder wants things written. Reuse the exact same \`key\` when you observe
something you have recorded before: that is what turns a guess into a
confident lesson instead of two near-identical notes.

Do not record the work you just produced, and do not re-record what is already
in your memory unchanged. One to three genuine lessons per run is normal; ten
is a sign you are summarising rather than learning.
`;

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

function truncate(text: string, limit = 12_000): string {
  return text.length <= limit
    ? text
    : `${text.slice(0, limit)}\n\n[truncated ${text.length - limit} characters]`;
}
