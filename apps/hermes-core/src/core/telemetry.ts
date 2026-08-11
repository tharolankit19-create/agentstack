import type { RunResult } from "./types";

/**
 * Reports a finished run back to AgentStack.
 *
 * The deployed agent holds no database credentials — it posts to a callback
 * URL with its own token instead. A leaked agent deployment therefore exposes
 * that one agent's runs, never the platform's data.
 */

export async function reportRun(result: RunResult): Promise<void> {
  const url = process.env.AGENTSTACK_CALLBACK_URL;
  const token = process.env.AGENT_TOKEN;
  const agentId = process.env.AGENT_ID;

  if (!url || !token || !agentId) return;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
        "x-agent-id": agentId,
      },
      body: JSON.stringify({
        agentId,
        runId: result.runId,
        templateId: result.templateId,
        trigger: result.trigger,
        ok: result.ok,
        error: result.error ?? null,
        output: result.output,
        generations: result.generations,
        // The write half of the memory loop, riding along on the request the
        // agent was making anyway rather than needing a second round trip and
        // a second auth surface.
        learnings: result.learnings,
        promptRevision: result.promptRevision,
        usage: result.usage,
        iterations: result.iterations,
        toolCalls: result.toolCalls,
        startedAt: result.startedAt,
        finishedAt: result.finishedAt,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      console.warn(`[hermes] callback rejected the run: HTTP ${response.status}`);
    }
  } catch (cause) {
    // A dead callback must never fail a run that already did its work.
    console.warn(
      `[hermes] callback failed: ${cause instanceof Error ? cause.message : String(cause)}`,
    );
  }
}
