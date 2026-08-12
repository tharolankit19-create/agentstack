import "server-only";

/**
 * X/Twitter, through Xquik — the same backend TweetClaw uses.
 *
 * TweetClaw itself is an OpenClaw plugin and cannot be dropped into a Next app,
 * but it is a thin wrapper over Xquik's REST API, and that we can call directly.
 * This gives two things the agents could not do before: the research squad can
 * read what's happening on X, and the content squad's drafts can actually be
 * posted — but only after the founder approves, never on the agent's own.
 *
 * Reads XQUIK_API_KEY from the environment and returns null/empty when it is
 * absent, so nothing here breaks a deploy that hasn't connected X yet.
 */

const BASE = "https://xquik.com/api/v1";

export function hasXquik(): boolean {
  return Boolean(process.env.XQUIK_API_KEY?.trim());
}

function key(): string | null {
  return process.env.XQUIK_API_KEY?.trim() || null;
}

async function call<T>(
  path: string,
  method: "GET" | "POST",
  body?: Record<string, unknown>,
): Promise<T | null> {
  const apiKey = key();
  if (!apiKey) return null;
  try {
    const response = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

/** The connected X account's username, or null if none is linked. */
export async function connectedAccount(): Promise<string | null> {
  const data = await call<{ data?: { username?: string }[] }>(
    "/x/accounts",
    "GET",
  );
  return data?.data?.[0]?.username ?? null;
}

export interface PostResult {
  ok: boolean;
  url?: string;
  error?: string;
}

/**
 * Post one tweet. A visible, irreversible write — only ever called after the
 * founder has explicitly approved the exact text.
 */
export async function postTweet(text: string): Promise<PostResult> {
  const account = await connectedAccount();
  if (!account) {
    return { ok: false, error: "No X account is connected in Xquik yet." };
  }

  const data = await call<{ data?: { id?: string }; error?: string }>(
    "/x/tweets",
    "POST",
    { account, text: text.slice(0, 280) },
  );

  if (!data || data.error) {
    return { ok: false, error: data?.error ?? "X rejected the post." };
  }
  const id = data.data?.id;
  return {
    ok: true,
    url: id ? `https://x.com/${account}/status/${id}` : undefined,
  };
}

export interface XHit {
  text: string;
  author: string;
  url: string;
}

/**
 * Search X for fresh signal — competitor mentions, a trend, what people are
 * saying. A read; free-tier-cheap, and used by the research pulse.
 */
export async function searchX(query: string, limit = 10): Promise<XHit[]> {
  const data = await call<{
    data?: { text?: string; author?: { username?: string }; id?: string }[];
  }>(`/x/search?query=${encodeURIComponent(query)}&limit=${limit}`, "GET");

  return (data?.data ?? []).map((t) => ({
    text: t.text ?? "",
    author: t.author?.username ?? "",
    url: t.id && t.author?.username
      ? `https://x.com/${t.author.username}/status/${t.id}`
      : "",
  }));
}
