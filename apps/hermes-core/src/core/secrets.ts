import type { SecretName } from "./types";

/**
 * Secrets reach a deployed agent exactly one way: as encrypted Vercel
 * environment variables written at deploy time. They are never read from the
 * database by this process, never returned by an API route, and never placed
 * in a message the model can see.
 */

const KNOWN_SECRETS: SecretName[] = [
  "OPENAI_API_KEY",
  "TWITTER_API_KEY",
  "TWITTER_API_SECRET",
  "TWITTER_ACCESS_TOKEN",
  "TWITTER_ACCESS_SECRET",
  "LINKEDIN_ACCESS_TOKEN",
  "LINKEDIN_AUTHOR_URN",
  "APOLLO_API_KEY",
];

export function getSecret(name: SecretName): string | undefined {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

export function requireSecret(name: SecretName): string {
  const value = getSecret(name);
  if (!value) {
    throw new Error(
      `Missing ${name}. Add it in your AgentStack dashboard and redeploy the agent.`,
    );
  }
  return value;
}

/** Which secrets this deployment actually holds — names only, never values. */
export function availableSecrets(): SecretName[] {
  return KNOWN_SECRETS.filter((name) => getSecret(name) !== undefined);
}

/**
 * Removes any live secret value from a string before it is logged or returned.
 * Cheap and blunt on purpose: a leaked key costs more than a wasted scan.
 */
export function redact(input: string): string {
  let out = input;
  for (const name of KNOWN_SECRETS) {
    const value = getSecret(name);
    if (value && value.length >= 8) {
      out = out.split(value).join(`[redacted:${name}]`);
    }
  }
  // Catch key-shaped strings we were never handed explicitly.
  out = out.replace(/\bsk-[A-Za-z0-9_-]{16,}\b/g, "[redacted:key]");
  return out;
}

export function redactDeep(value: unknown): unknown {
  if (typeof value === "string") return redact(value);
  if (Array.isArray(value)) return value.map(redactDeep);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        /key|secret|token|password/i.test(k) ? "[redacted]" : redactDeep(v),
      ]),
    );
  }
  return value;
}
