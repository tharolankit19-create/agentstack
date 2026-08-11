/**
 * The read half of the loop that makes an agent better than it was yesterday.
 *
 * Before a run starts, the agent asks the platform what it concluded the last
 * few hundred times it did this job. The answer arrives as a prose block that
 * goes at the top of the system prompt, plus any prompt the agent previously
 * rewrote *and the customer approved*.
 *
 * Three deliberate choices.
 *
 * **Fetched at runtime, not baked in at deploy.** An agent runs daily and is
 * redeployed maybe twice a year. Memory delivered as an environment variable
 * would be six months stale by the time it mattered.
 *
 * **It fails open.** If the platform is unreachable the agent runs with an
 * empty memory, which is exactly how it behaved before any of this existed. An
 * agent that refuses to work because it could not remember is worse than one
 * that works from a blank page.
 *
 * **Small.** The block is capped platform-side. Memory that grows without
 * bound eats the context window it exists to make better use of.
 */

export interface FetchedMemory {
  /** The prose block, ready to prepend. Empty when nothing has been learned. */
  brief: string;
  /** Approved rewrites, by prompt name. */
  prompts: Record<string, { body: string; version: number }>;
}

const EMPTY: FetchedMemory = { brief: "", prompts: {} };

export async function fetchMemory(): Promise<FetchedMemory> {
  const base = process.env.AGENTSTACK_CALLBACK_URL;
  const token = process.env.AGENT_TOKEN;
  const agentId = process.env.AGENT_ID;

  if (!base || !token || !agentId) return EMPTY;

  // The callback URL points at .../api/agents/callback; memory is its sibling.
  // Derived rather than a second environment variable, so an agent deployed
  // before this existed picks it up on its next run without a config change.
  const url = base.replace(/\/callback\/?$/, "/memory");
  if (url === base) return EMPTY;

  try {
    const response = await fetch(url, {
      headers: {
        authorization: `Bearer ${token}`,
        "x-agent-id": agentId,
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) return EMPTY;

    const payload = (await response.json()) as Partial<FetchedMemory>;
    return {
      brief: typeof payload.brief === "string" ? payload.brief : "",
      prompts: payload.prompts ?? {},
    };
  } catch {
    // Fail open, loudly enough to debug and quietly enough not to fail a run.
    console.warn("[hermes] could not load memory; running without it");
    return EMPTY;
  }
}
