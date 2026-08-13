import "server-only";
import { createHmac } from "node:crypto";
import { timingSafeEqualStrings } from "./crypto";

/**
 * The secret that guards the cron endpoints — with nothing to configure.
 *
 * These endpoints do real work (send Telegram messages, run scheduled tasks),
 * so they must not be open to the world. The obvious way is a `CRON_SECRET`
 * environment variable, but that is one more thing a founder has to set in
 * Vercel before anything runs — and when it is missing, every scheduled call
 * fails and the scheduler emails errors.
 *
 * So we borrow the Telegram webhook's trick: if `CRON_SECRET` is not set, derive
 * one from `SECRETS_ENCRYPTION_KEY`, which the app already requires and already
 * keeps secret. Whatever triggers the cron (Supabase pg_cron, an external
 * scheduler) computes the same value the same way, so the two always agree with
 * zero setup. An explicit `CRON_SECRET` still wins, for anyone who wants to
 * rotate it independently.
 */
export function cronSecret(): string | null {
  const explicit = process.env.CRON_SECRET?.trim();
  if (explicit) return explicit;

  const base = process.env.SECRETS_ENCRYPTION_KEY?.trim();
  if (!base) return null;

  return createHmac("sha256", base).update("agentstack-cron-v1").digest("hex");
}

/**
 * Whether a request carries the right cron bearer token.
 *
 * Returns false — never throws — so a route can answer 401 plainly. The token
 * is compared in constant time to avoid leaking it a character at a time.
 */
export function authorizeCron(request: Request): boolean {
  const secret = cronSecret();
  if (!secret) return false;

  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  return timingSafeEqualStrings(token, secret);
}
