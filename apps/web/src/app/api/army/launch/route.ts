import { NextResponse } from "next/server";
import { requireOperatorApiUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { deployAgent } from "@/lib/deploy";
import { rosterTemplateIds } from "@/lib/army";
import { rateLimit } from "@/lib/rate-limit";
import type { Agent } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * Turn the whole army on.
 *
 * Deploying fourteen agents by pressing fourteen buttons is the reason people
 * stopped at two, and "why is nothing running" was the most common thing to be
 * confused about on the old dashboard: agents existed, they were configured,
 * and every one of them was sitting in draft waiting for a click nobody knew
 * they had to make.
 *
 * **A batch at a time, not all fourteen.** Each deploy uploads the runtime and
 * waits for Vercel to accept a build. Fourteen of those in one request is a
 * request that times out somewhere in the middle, and a timeout here is
 * indistinguishable from a failure while actually having half-worked. So this
 * does a few, reports how many are left, and the client calls again — which
 * also gives the founder a progress bar instead of a spinner.
 *
 * The head agent goes first, in roster order, for the same reason it is
 * created first: it is the one they will be talking to.
 */

/** How many per call. Sized so the slowest realistic batch still finishes. */
const BATCH = 3;

export async function POST() {
  const auth = await requireOperatorApiUser();
  if (!auth.ok) return auth.response;

  const limit = rateLimit(`launch:${auth.session.userId}`, 30, 3600);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "That is a lot of deploys in an hour. Try again shortly." },
      { status: 429 },
    );
  }

  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("agents")
    .select("*")
    .eq("user_id", auth.session.userId);

  const agents = (rows ?? []) as Agent[];

  // Roster order, so the commander is first and the squads follow. Anything
  // not in the roster — a custom agent built from a pasted URL — goes last.
  const order = rosterTemplateIds();
  const rank = (agent: Agent) => {
    const at = order.indexOf(agent.template_id);
    return at === -1 ? order.length : at;
  };

  const pending = agents
    .filter((agent) => agent.status !== "deployed" && agent.status !== "deploying")
    .sort((a, b) => rank(a) - rank(b));

  if (pending.length === 0) {
    return NextResponse.json({
      deployed: 0,
      remaining: 0,
      failed: [],
      done: true,
      message: "Your whole army is already live.",
    });
  }

  const batch = pending.slice(0, BATCH);
  const failed: { name: string; reason: string }[] = [];
  let deployed = 0;

  // Sequential. Concurrent deploys to the same Vercel account get rate limited,
  // and a 429 from Vercel would surface here as an agent that failed for no
  // reason the customer can act on.
  for (const agent of batch) {
    try {
      await deployAgent(agent);
      deployed += 1;
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : "Deploy failed.";
      failed.push({ name: agent.name, reason });

      await admin
        .from("agents")
        .update({ status: "error", last_error: reason })
        .eq("id", agent.id);
    }
  }

  const remaining = Math.max(pending.length - batch.length, 0);

  return NextResponse.json({
    deployed,
    remaining,
    failed,
    done: remaining === 0,
    total: agents.length,
  });
}
