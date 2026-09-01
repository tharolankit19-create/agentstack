import "server-only";
import { callableCronSecret } from "./cron-auth";

/**
 * The one clock the whole army runs on.
 *
 * Every scheduled thing this product promises — the morning briefing, the
 * research pulse, "at 5pm do X", the squads doing today's job — lives behind a
 * `/api/cron/*` endpoint that does the work correctly and waits to be called.
 * Nothing was calling them. The GitHub Actions workflow that used to was
 * deleted when the schedule moved to Supabase pg_cron, and the pg_cron
 * migration was never written, so the army has been asleep: endpoints in
 * perfect health, and no heartbeat reaching them.
 *
 * The fix is deliberately one endpoint instead of five. A single `/api/cron/
 * heartbeat` is the only thing an outside scheduler ever has to know about,
 * which matters more than it sounds: Vercel's Hobby plan allows two cron jobs,
 * so five schedules could not fit there at all, and every extra entry in a
 * GitHub workflow is another place a URL can rot. One entry, called often,
 * fans out to whatever is actually due.
 *
 * "Due" is decided from the database, not from the wall clock. A worker records
 * when it last ran, and runs again once its interval has elapsed. That is what
 * makes the schedule self-healing: if the heartbeat is late, or missed an hour,
 * or the deploy was down all night, the next tick still finds everything that
 * is overdue and runs it — instead of skipping a slot forever because a minute
 * did not line up.
 */

export interface Worker {
  /** Path under /api/cron/. */
  name: string;
  /** How often it should run, in minutes. */
  everyMinutes: number;
  /** What it does, for the heartbeat's own log line. */
  does: string;
}

/**
 * The cadences, in the order they are dispatched.
 *
 * Ordered by how much a founder notices when it is late. A scheduled task the
 * founder asked for at 5pm is the most visible promise in the product, so it
 * is checked most often and dispatched first; the shared-playbook rollup is
 * invisible and nightly, so it goes last.
 */
export const WORKERS: Worker[] = [
  { name: "tasks", everyMinutes: 5, does: "runs whatever the founder scheduled" },
  { name: "agents", everyMinutes: 15, does: "puts the squads to work" },
  { name: "pipeline", everyMinutes: 15, does: "runs the outreach squad end to end" },
  { name: "briefing", everyMinutes: 15, does: "sends the briefing when a founder's slot comes round" },
  { name: "research", everyMinutes: 60, does: "the research pulse, alerts only if urgent" },
  { name: "playbook", everyMinutes: 1440, does: "promotes lessons into the shared playbook" },
];

/** How long the heartbeat waits on a worker before letting go of it. */
const DISPATCH_TIMEOUT_MS = 15_000;

/**
 * Where to call ourselves.
 *
 * The heartbeat invokes the workers over HTTP rather than importing them, so
 * each one gets its own serverless invocation and its own 300-second budget.
 * Five workers sharing the heartbeat's clock would be five ways to time out.
 */
export function selfUrl(): string | null {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;

  return null;
}

export interface DispatchResult {
  worker: string;
  /** "ran" once handed off, "late" if it was overdue, "failed" if unreachable. */
  outcome: "ran" | "failed";
  error?: string;
}

/**
 * Hand a worker its turn, and stop caring about the answer.
 *
 * The abort is not a cancellation. Aborting the *client* side of a fetch to a
 * serverless route does not stop the route — that invocation keeps running to
 * completion on its own. So a worker that takes four minutes still finishes its
 * four minutes of work; the heartbeat simply refuses to sit and wait for it,
 * which is what keeps one slow model from turning the whole tick into a
 * timeout and stalling every other squad behind it.
 */
export async function dispatch(base: string, worker: Worker): Promise<DispatchResult> {
  const secret = await callableCronSecret();
  if (!secret) return { worker: worker.name, outcome: "failed", error: "No cron secret configured." };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DISPATCH_TIMEOUT_MS);

  try {
    await fetch(`${base}/api/cron/${worker.name}`, {
      headers: { authorization: `Bearer ${secret}` },
      signal: controller.signal,
      cache: "no-store",
    });
    return { worker: worker.name, outcome: "ran" };
  } catch (error) {
    // An abort means "still working, we let go" — the intended path for a long
    // worker, not a failure. Anything else is a real problem worth reporting.
    if (error instanceof Error && error.name === "AbortError") {
      return { worker: worker.name, outcome: "ran" };
    }
    return {
      worker: worker.name,
      outcome: "failed",
      error: error instanceof Error ? error.message : "Unreachable.",
    };
  } finally {
    clearTimeout(timer);
  }
}
