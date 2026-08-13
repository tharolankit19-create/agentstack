import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authorizeCron } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * The nightly rollup that turns private lessons into shared ones.
 *
 * Every agent writes what it learned into its own customer's private notes.
 * This is the only thing that ever reads across customers, and all it does is
 * count: a lesson is promoted into the shared playbook once several different
 * customers have independently arrived at it, at which point it has stopped
 * being a fact about anybody's business and become a fact about the job.
 *
 * The anonymity floor lives in `promote_playbook()` rather than here, so it
 * holds no matter who calls it — including a future caller nobody has written
 * yet. This route only decides *when*.
 *
 * Vercel signs its cron requests with `CRON_SECRET`. Verified in constant time,
 * and the route refuses to run at all when the secret is unset rather than
 * defaulting to open: a rollup endpoint anyone can hit is a way to make the
 * database do unbounded aggregation work on request.
 */
export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("promote_playbook", { p_min_users: 3 });

  if (error) {
    console.error("[cron/playbook] rollup failed:", error);
    return NextResponse.json({ error: "Rollup failed." }, { status: 500 });
  }

  return NextResponse.json({ promoted: data ?? 0 });
}
