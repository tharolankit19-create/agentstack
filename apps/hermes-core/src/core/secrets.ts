import type { SecretName } from "./types";

/**
 * Secrets reach a deployed agent exactly one way: as encrypted Vercel
 * environment variables written at deploy time. They are never read from the
 * database by this process, never returned by an API route, and never placed
 * in a message the model can see.
 */

/**
 * Names the platform knows about. Custom agents carry credentials outside this
 * list, so redaction also scans for anything env-shaped that looks like a key.
 */
const KNOWN_SECRETS = [
  "OPENAI_API_KEY",
  "TWITTER_API_KEY",
  "TWITTER_API_SECRET",
  "TWITTER_ACCESS_TOKEN",
  "TWITTER_ACCESS_SECRET",
  "LINKEDIN_ACCESS_TOKEN",
  "LINKEDIN_AUTHOR_URN",
  "APOLLO_API_KEY",
  "RESEND_API_KEY",
  "SERVICE_API_KEY",
  "SLACK_WEBHOOK_URL",
  "NOTION_API_KEY",
  "STRIPE_API_KEY",
  "GA4_PROPERTY_ID",
];

/** Any env var whose name looks like a credential is redacted from output. */
const SECRET_NAME_PATTERN = /(_API_KEY|_SECRET|_TOKEN|_PASSWORD|_WEBHOOK_URL)$/;

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

/** Which secrets this deployment holds — names only, never values. */
export function availableSecrets(): SecretName[] {
  return secretEnvNames().filter((name) => getSecret(name) !== undefined);
}

function secretEnvNames(): string[] {
  const fromEnv = Object.keys(process.env).filter((key) =>
    SECRET_NAME_PATTERN.test(key),
  );
  return [...new Set([...KNOWN_SECRETS, ...fromEnv])];
}

/**
 * Removes any live secret value from a string before it is logged or returned.
 * Cheap and blunt on purpose: a leaked key costs more than a wasted scan.
 */
export function redact(input: string): string {
  let out = input;

  for (const name of secretEnvNames()) {
    const value = getSecret(name);
    if (value && value.length >= 8) {
      out = out.split(value).join(`[redacted:${name}]`);
    }
  }

  // Key-shaped strings we were never handed explicitly.
  out = out.replace(/\bsk-[A-Za-z0-9_-]{16,}\b/g, "[redacted:key]");
  out = out.replace(/\bBearer\s+[A-Za-z0-9._~+/-]{16,}=*/gi, "Bearer [redacted]");
  return out;
}

export function redactDeep(value: unknown): unknown {
  if (typeof value === "string") return redact(value);
  if (Array.isArray(value)) return value.map(redactDeep);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        /key|secret|token|password|authorization/i.test(k)
          ? "[redacted]"
          : redactDeep(v),
      ]),
    );
  }
  return value;
}
