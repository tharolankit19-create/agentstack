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
 * The token the in-database scheduler signs its calls with.
 *
 * `0017_internal_scheduler.sql` generates this row and pg_cron calls the
 * heartbeat with it every five minutes. Reading it back here is what makes that
 * scheduler need no configuration at all: there is no environment variable for
 * an operator to keep in sync, because both sides read the same row.
 *
 * Cached briefly. This is checked on every cron request, and a database round
 * trip per beat — five workers, every five minutes, forever — is a real cost
 * for a value that changes essentially never.
 */
let cached: { value: string | null; at: number } | null = null;
const CACHE_MS = 60_000;

async function schedulerSecret(): Promise<string | null> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.value;

  let value: string | null = null;
  try {
    const { createAdminClient } = await import("./supabase/admin");
    const { data } = await createAdminClient()
      .from("scheduler_config")
      .select("secret")
      .maybeSingle<{ secret: string }>();
    value = data?.secret?.trim() || null;
  } catch {
    // No table, no database, no scheduler. The env-derived path still works.
    value = null;
  }

  cached = { value, at: Date.now() };
  return value;
}

/**
 * Whether a request carries a valid cron bearer token.
 *
 * Two tokens are accepted, and which one arrives says who is calling: the
 * environment-derived secret belongs to an outside scheduler (GitHub Actions,
 * Vercel Cron, an uptime pinger), and the database-held one belongs to the
 * in-database scheduler. Both are legitimate and either alone is enough, which
 * is the point — a founder who wires up neither still gets a working clock from
 * the migration, and one who wires up both is not punished with a conflict.
 *
 * Returns false — never throws — so a route can answer 401 plainly. Both
 * comparisons run in constant time, and both always run: returning early on the
 * first match would leak, through timing, which scheduler the caller matched.
 */
export async function authorizeCron(request: Request): Promise<boolean> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return false;

  const env = cronSecret();
  const db = await schedulerSecret();

  const envOk = env ? timingSafeEqualStrings(token, env) : false;
  const dbOk = db ? timingSafeEqualStrings(token, db) : false;

  return envOk || dbOk;
}


/**
 * A token this app's own cron endpoints will accept, for calling them.
 *
 * The heartbeat dispatches to its workers over HTTP, so it has to authenticate
 * to itself. It prefers the environment-derived secret and falls back to the
 * scheduler's, so a deployment configured either way can still fan out — a
 * heartbeat that can be reached but cannot reach its own workers is the worst
 * of the failure modes, because everything upstream of it looks healthy.
 */
export async function callableCronSecret(): Promise<string | null> {
  return cronSecret() ?? (await schedulerSecret());
}
