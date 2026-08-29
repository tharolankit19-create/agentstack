import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authorizeCron } from "@/lib/cron-auth";
import { WORKERS, dispatch, selfUrl, type DispatchResult } from "@/lib/heartbeat";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * The heartbeat. The only schedule anything outside this app needs to know.
 *
 * Call this every few minutes — from GitHub Actions, Vercel Cron, or any
 * uptime pinger — and it works out which of the five cron workers are overdue
 * and sets them going. Everything the product promises to do on its own runs
 * because this endpoint gets hit.
 *
 * Two properties are worth keeping when editing this:
 *
 * A worker's turn is claimed *before* it is dispatched, not after. If claiming
 * came second, a worker that runs longer than the gap between two heartbeats
 * would be started again while it was still going — twice the model spend, and
 * two copies of the same briefing in the founder's Telegram. Claiming first
 * means the worst case is a skipped turn, which the next tick picks up anyway,
 * instead of a duplicate one, which the founder sees.
 *
 * And the claim is a conditional update, so two heartbeats arriving at the same
 * instant cannot both win it. Whoever's update matches a row that is still
 * overdue gets the turn; the other gets zero rows back and moves on.
 */
export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const base = selfUrl();
  if (!base) {
    // Without this the heartbeat cannot reach its own workers, and would report
    // a cheerful "0 due" forever. Say what is wrong instead.
    return NextResponse.json(
      { error: "Set NEXT_PUBLIC_APP_URL so the heartbeat can reach its workers." },
      { status: 500 },
    );
  }

  const admin = createAdminClient();
  const now = new Date();

  // `force` runs everything regardless of cadence — the button you press after
  // a deploy to prove the wiring works, rather than waiting fifteen minutes to
  // find out it does not.
  const force = new URL(request.url).searchParams.get("force") === "1";

  const dispatched: DispatchResult[] = [];
  const skipped: string[] = [];

  for (const worker of WORKERS) {
    const dueBefore = new Date(now.getTime() - worker.everyMinutes * 60_000).toISOString();

    if (!force) {
      // Claim the turn: only succeeds if this worker has not run inside its own
      // interval. `last_run_at is null` covers the first tick after deploy.
      const { data: claimed } = await admin
        .from("cron_ticks")
        .update({ last_run_at: now.toISOString() })
        .eq("worker", worker.name)
        .or(`last_run_at.is.null,last_run_at.lte.${dueBefore}`)
        .select("worker");

      if (!claimed?.length) {
        skipped.push(worker.name);
        continue;
      }
    } else {
      await admin
        .from("cron_ticks")
        .update({ last_run_at: now.toISOString() })
        .eq("worker", worker.name);
    }

    dispatched.push(await dispatch(base, worker));
  }

  const failed = dispatched.filter((d) => d.outcome === "failed");
  if (failed.length) {
    // Worth a log line: a worker that cannot be reached is the whole army
    // silently stopping, which is exactly the failure this endpoint exists to
    // prevent. Still answer 200 — the scheduler retrying does not fix a bad URL.
    console.error("[cron/heartbeat] unreachable workers:", failed);
  }

  return NextResponse.json({
    at: now.toISOString(),
    dispatched: dispatched.map((d) => d.worker),
    skipped,
    failed: failed.map((f) => ({ worker: f.worker, error: f.error })),
  });
}
