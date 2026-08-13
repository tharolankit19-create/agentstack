import "server-only";

/**
 * Firecrawl, the eyes of the research and competitor agents.
 *
 * Everything the research squad actually *knows* about the outside world comes
 * through here: a competitor's live pricing page, this week's news, a page that
 * changed overnight. Without it those agents can only reason about what the
 * founder typed, which is why "the research isn't doing research" — there was
 * nothing feeding it real pages.
 *
 * Reads the key from the environment (the founder adds FIRECRAWL_API_KEY), and
 * degrades to null rather than throwing when it is absent, so a deploy without
 * a key still runs — it just has nothing to look at yet.
 */

const BASE = "https://api.firecrawl.dev/v1";

export function hasFirecrawl(): boolean {
  return Boolean(process.env.FIRECRAWL_API_KEY?.trim());
}

/**
 * The key to use: whatever the caller passes (the founder's own, from their
 * connectors) wins; otherwise the platform's, from the environment.
 */
function key(override?: string): string | null {
  return override?.trim() || process.env.FIRECRAWL_API_KEY?.trim() || null;
}

/**
 * The readable text of one page, as markdown.
 *
 * Truncated hard: a competitor's page can be enormous, and the model only needs
 * enough to notice what changed, not the whole DOM.
 */
export async function scrape(
  url: string,
  maxChars = 6000,
  apiKeyOverride?: string,
): Promise<string | null> {
  const apiKey = key(apiKeyOverride);
  if (!apiKey || !url) return null;

  try {
    const response = await fetch(`${BASE}/scrape`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["markdown"],
        onlyMainContent: true,
      }),
      signal: AbortSignal.timeout(45_000),
    });

    if (!response.ok) return null;
    const payload = (await response.json()) as {
      data?: { markdown?: string };
    };
    const md = payload.data?.markdown;
    return md ? md.slice(0, maxChars) : null;
  } catch {
    return null;
  }
}

export interface SearchHit {
  title: string;
  url: string;
  description: string;
}

/**
 * A web search for fresh signal — news, launches, mentions.
 *
 * Used by the research pulse to answer "what happened this week that this
 * founder should know about", which no amount of scraping their own pages can.
 */
export async function search(
  query: string,
  limit = 5,
  apiKeyOverride?: string,
): Promise<SearchHit[]> {
  const apiKey = key(apiKeyOverride);
  if (!apiKey || !query) return [];

  try {
    const response = await fetch(`${BASE}/search`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ query, limit }),
      signal: AbortSignal.timeout(45_000),
    });

    if (!response.ok) return [];
    const payload = (await response.json()) as {
      data?: { title?: string; url?: string; description?: string }[];
    };
    return (payload.data ?? []).map((hit) => ({
      title: hit.title ?? "",
      url: hit.url ?? "",
      description: hit.description ?? "",
    }));
  } catch {
    return [];
  }
}
