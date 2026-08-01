import type { Message } from "./types";

/**
 * Conversation + context storage.
 *
 * A deployed agent is a serverless function: process memory does not survive
 * between invocations, so durable history lives in AgentStack (Supabase) and
 * arrives with each request. This module owns the two things that *are* local
 * to a run — assembling the working transcript and keeping it inside the
 * model's context window.
 *
 * Trimming rule, taken straight from Hermes: never touch the prefix. The
 * system prompt and the oldest turns that follow it stay byte-identical across
 * turns so the provider's prompt cache keeps hitting; when the transcript gets
 * long we drop from the middle and leave a marker.
 */

const APPROX_CHARS_PER_TOKEN = 4;

export interface MemoryOptions {
  /** Token budget for everything except the system prompt. */
  maxHistoryTokens?: number;
  /** Turns at the start of the conversation that are never dropped. */
  keepHead?: number;
  /** Most recent turns that are never dropped. */
  keepTail?: number;
}

export class Memory {
  private readonly maxHistoryTokens: number;
  private readonly keepHead: number;
  private readonly keepTail: number;
  private messages: Message[] = [];

  constructor(
    private readonly systemPrompt: string,
    options: MemoryOptions = {},
  ) {
    this.maxHistoryTokens = options.maxHistoryTokens ?? 24_000;
    this.keepHead = options.keepHead ?? 2;
    this.keepTail = options.keepTail ?? 12;
  }

  /** Seeds prior turns from durable storage. */
  hydrate(history: Message[]): void {
    this.messages = history.filter((m) => m.role !== "system").slice();
  }

  push(message: Message): void {
    this.messages.push(message);
  }

  pushAll(messages: Message[]): void {
    for (const m of messages) this.push(m);
  }

  /** Everything after the system prompt, in order. */
  history(): Message[] {
    return this.messages.slice();
  }

  /** The full message list to send to the model this turn. */
  render(): Message[] {
    return [
      { role: "system", content: this.systemPrompt },
      ...this.compress(this.messages),
    ];
  }

  private compress(messages: Message[]): Message[] {
    if (estimateTokens(messages) <= this.maxHistoryTokens) return messages;
    if (messages.length <= this.keepHead + this.keepTail) return messages;

    const head = messages.slice(0, this.keepHead);
    let tail = messages.slice(-this.keepTail);

    // A tool result whose request was dropped confuses every provider, so the
    // tail always starts on a clean boundary.
    while (tail.length > 0 && tail[0].role === "tool") tail = tail.slice(1);

    const dropped = messages.length - head.length - tail.length;
    const marker: Message = {
      role: "user",
      content: `[${dropped} earlier messages trimmed to fit the context window]`,
    };
    return [...head, marker, ...tail];
  }
}

export function estimateTokens(messages: Message[]): number {
  let chars = 0;
  for (const m of messages) {
    chars += m.content.length;
    for (const call of m.tool_calls ?? []) {
      chars += call.name.length + JSON.stringify(call.arguments).length;
    }
  }
  return Math.ceil(chars / APPROX_CHARS_PER_TOKEN);
}
