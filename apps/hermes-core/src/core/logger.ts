import { redactDeep } from "./secrets";

export interface LogEntry {
  ts: string;
  event: string;
  data?: Record<string, unknown>;
}

/**
 * Per-run log buffer. Entries are redacted on the way in, so anything that
 * later ships to AgentStack or lands in Vercel's log drain is already safe.
 */
export class RunLogger {
  readonly entries: LogEntry[] = [];

  constructor(private readonly runId: string) {}

  log(event: string, data?: Record<string, unknown>): void {
    const entry: LogEntry = {
      ts: new Date().toISOString(),
      event,
      data: data ? (redactDeep(data) as Record<string, unknown>) : undefined,
    };
    this.entries.push(entry);
    console.log(`[hermes:${this.runId}] ${event}`, entry.data ?? "");
  }
}
