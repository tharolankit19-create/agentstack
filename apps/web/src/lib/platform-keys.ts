import "server-only";

/**
 * Every key the army runs on belongs to the platform.
 *
 * This replaces a model where the founder pasted their own Firecrawl, Apollo
 * and Monid keys before anything worked. That model has one fatal property: a
 * founder who signs up and does nothing gets agents that do nothing, and they
 * conclude the product is broken rather than unconfigured. They are not wrong —
 * a marketing team you have to supply with data vendors is not a marketing
 * team, it is a kit.
 *
 * So the keys are ours, set once in the deployment environment, and the founder
 * configures nothing to get a working army. What they will eventually connect
 * are *their own accounts* — the X account to post from, the inbox to send from
 * — which is a sign-in, not a secret to paste.
 *
 * Reads the environment on every call rather than caching. These are looked up
 * a handful of times per request, `process.env` is an object property read, and
 * a cache here would mean a key rotation needed a redeploy to take effect.
 */

/** The model key every agent thinks with. */
export function platformModelKey(): string | null {
  return (
    process.env.OPENROUTER_API_KEY?.trim() ||
    process.env.PLATFORM_OPENROUTER_KEY?.trim() ||
    process.env.PLATFORM_MODEL_KEY?.trim() ||
    null
  );
}

/** Monid: leads, rankings, reviews, social, company data — hundreds of tools. */
export function platformMonidKey(): string | null {
  return process.env.MONID_API_KEY?.trim() || null;
}

/** Firecrawl: reading live pages and searching the web. */
export function platformFirecrawlKey(): string | null {
  return process.env.FIRECRAWL_API_KEY?.trim() || null;
}

/** What is switched on right now, for the diagnosis and the health check. */
export function platformCapabilities(): {
  model: boolean;
  monid: boolean;
  firecrawl: boolean;
  /** True when the army can do its core job: think, and look things up. */
  ready: boolean;
} {
  const model = Boolean(platformModelKey());
  const monid = Boolean(platformMonidKey());
  const firecrawl = Boolean(platformFirecrawlKey());

  // The model key is the only one that is genuinely fatal. Without Monid or
  // Firecrawl the agents are less useful but still work; without a model they
  // cannot produce a sentence.
  return { model, monid, firecrawl, ready: model };
}
