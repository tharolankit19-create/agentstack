import OpenAI from "openai";
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions";
import type { Message, Tool, ToolCall } from "@/core/types";
import { requireSecret } from "@/core/secrets";

/**
 * The only place this engine talks to an LLM.
 *
 * The base URL is configurable, so a founder can point an agent at OpenAI,
 * OpenRouter, Nous Portal, or any OpenAI-compatible endpoint without a code
 * change — the same "no lock-in" property Hermes has.
 */

export interface CompletionResult {
  content: string;
  toolCalls: ToolCall[];
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
  finishReason: string;
}

let cached: OpenAI | null = null;

export function llm(): OpenAI {
  if (cached) return cached;
  cached = new OpenAI({
    apiKey: requireSecret("OPENAI_API_KEY"),
    baseURL: process.env.OPENAI_BASE_URL || undefined,
    maxRetries: 3,
    timeout: 120_000,
  });
  return cached;
}

export async function complete(options: {
  model: string;
  temperature: number;
  messages: Message[];
  tools?: Tool[];
  signal?: AbortSignal;
}): Promise<CompletionResult> {
  const response = await llm().chat.completions.create(
    {
      model: options.model,
      temperature: options.temperature,
      messages: options.messages.map(toOpenAIMessage),
      ...(options.tools?.length
        ? { tools: options.tools.map(toOpenAITool), tool_choice: "auto" as const }
        : {}),
    },
    { signal: options.signal },
  );

  const choice = response.choices[0];
  const raw = choice?.message;

  const toolCalls: ToolCall[] = (raw?.tool_calls ?? []).flatMap((call) => {
    if (call.type !== "function") return [];
    return [
      {
        id: call.id,
        name: call.function.name,
        arguments: safeParseArgs(call.function.arguments),
      },
    ];
  });

  return {
    content: raw?.content ?? "",
    toolCalls,
    usage: {
      promptTokens: response.usage?.prompt_tokens ?? 0,
      completionTokens: response.usage?.completion_tokens ?? 0,
      totalTokens: response.usage?.total_tokens ?? 0,
    },
    finishReason: choice?.finish_reason ?? "stop",
  };
}

/** One-shot text generation for tools that need a model but not the loop. */
export async function generateText(options: {
  model?: string;
  temperature?: number;
  system: string;
  user: string;
  signal?: AbortSignal;
}): Promise<string> {
  const result = await complete({
    model: options.model ?? process.env.AGENT_MODEL ?? "gpt-4o-mini",
    temperature: options.temperature ?? 0.7,
    messages: [
      { role: "system", content: options.system },
      { role: "user", content: options.user },
    ],
    signal: options.signal,
  });
  return result.content.trim();
}

function toOpenAIMessage(message: Message): ChatCompletionMessageParam {
  switch (message.role) {
    case "tool":
      return {
        role: "tool",
        content: message.content,
        tool_call_id: message.tool_call_id ?? "",
      };
    case "assistant":
      return {
        role: "assistant",
        content: message.content || null,
        ...(message.tool_calls?.length
          ? {
              tool_calls: message.tool_calls.map((call) => ({
                id: call.id,
                type: "function" as const,
                function: {
                  name: call.name,
                  arguments: JSON.stringify(call.arguments ?? {}),
                },
              })),
            }
          : {}),
      };
    case "system":
      return { role: "system", content: message.content };
    default:
      return { role: "user", content: message.content };
  }
}

function toOpenAITool(tool: Tool): ChatCompletionTool {
  return {
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters as unknown as Record<string, unknown>,
    },
  };
}

function safeParseArgs(raw: string): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}
