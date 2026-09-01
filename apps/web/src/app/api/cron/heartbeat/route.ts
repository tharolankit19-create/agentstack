import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authorizeCron } from "@/lib/cron-auth";
import { WORKERS, dispatch, selfUrl, type DispatchResult } from "@/lib/heartbeat";
import type { CronTick } from "@/lib/supabase/types";

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
  if (!(await authorizeCron(request))) {
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

  const { data: tickRows } = await admin
    .from("cron_ticks")
    .select("worker, last_run_at, updated_at");
  const ticks = new Map(
    ((tickRows ?? []) as CronTick[]).map((t) => [t.worker, t.last_run_at]),
  );

  const dispatched: DispatchResult[] = [];
  const skipped: string[] = [];

  for (const worker of WORKERS) {
    const lastRun = ticks.get(worker.name) ?? null;
    const due =
      force || !lastRun || now.getTime() - Date.parse(lastRun) >= worker.everyMinutes * 60_000;

    if (!due) {
      skipped.push(worker.name);
      continue;
    }

    // Claim the turn by compare-and-swap against the exact value just read.
    // Two heartbeats arriving together both see the same `lastRun`; only the
    // one whose update still matches it writes a row, and the other gets none
    // back and moves on. An exact match rather than a "not run since" filter on
    // purpose — a timestamp embedded in a PostgREST boolean filter is a parsing
    // question nobody should have to think about in the one piece of code the
    // whole schedule depends on.
    const claim = admin
      .from("cron_ticks")
      .update({ last_run_at: now.toISOString() })
      .eq("worker", worker.name);

    const { data: claimed } = await (
      lastRun ? claim.eq("last_run_at", lastRun) : claim.is("last_run_at", null)
    ).select("worker");

    // A forced run dispatches whether or not it won the claim — it is a manual
    // "prove the wiring" call, and losing a race to a scheduled tick is not a
    // reason to answer with nothing.
    if (!claimed?.length && !force) {
      skipped.push(worker.name);
      continue;
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
