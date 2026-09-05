import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { deployAgent } from "@/lib/deploy";
import { vercelClientFor } from "@/lib/user-hosting";
import { rateLimit } from "@/lib/rate-limit";
import { VercelError } from "@/lib/vercel";
import { isEntitled } from "@/lib/plans";
import type { Agent } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * Build and deploy the whole army, on our Vercel account.
 *
 * The founder supplies no token and never sees Vercel. `vercelClientFor`
 * resolves to the platform client for every managed account, which since the
 * move to credits is every account — so these projects are created under
 * `VERCEL_API_TOKEN` from the platform environment, exactly as intended.
 *
 * **One project per agent is the cost of this, and it is worth stating.** An
 * army is around twenty-five projects, and a Vercel account has a hard ceiling
 * on how many it can hold, so this pre-flights the count and refuses cleanly
 * when there is not room for the whole batch. That refusal is the point:
 * without it, a launch succeeds for the first several agents and then fails
 * partway with whatever Vercel says about limits, leaving a half-built army and
 * no way to tell which half.
 *
 * **A batch per request.** This is the endpoint `NextStep` has been calling
 * since it was written — it loops, showing progress, until the response says
 * `done` — and until now the endpoint did not exist, so the one button that
 * turns the army on has been posting to a 404 and reporting a failure with no
 * cause. That is the whole reason nothing ever deployed.
 *
 * Batching is also the right shape regardless. Each deploy uploads a runtime
 * bundle and asks Vercel to build it; twenty-five in one request exceeds the
 * function's own timeout partway through, which looks exactly like a failure
 * while having half-worked.
 *
 * Partial success is a real outcome and is reported as one. An agent that
 * cannot deploy yet — Telegram not linked, a required key missing — is reported
 * with the reason and does not stop the rest, because the alternative is one
 * unlinked chat blocking twenty-four agents that were ready.
 */

/**
 * Agents per request.
 *
 * Small enough that a batch finishes well inside `maxDuration` even when every
 * deploy is slow, which is what keeps the client's progress honest.
 */
const BATCH = 4;

/** Headroom left free on the account, so a launch never consumes the last slot. */
const RESERVE = 10;

/** What a Vercel account can hold. Conservative: exceeding it fails the deploy. */
const PROJECT_CEILING = Number(process.env.VERCEL_PROJECT_CEILING ?? 200) || 200;

interface Failure {
  name: string;
  reason: string;
}

export async function POST() {
  const session = await requireUser();

  // Credits, not a plan. Deploying spends our Vercel quota rather than the
  // founder's balance, so the gate is only "is this a real, funded account".
  if (!isEntitled(session.profile)) {
    return NextResponse.json(
      { error: "Add credits before launching the army.", code: "no_credits" },
      { status: 402 },
    );
  }

  const limit = rateLimit(`launch:${session.userId}`, 3, 3600);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "A launch is already running. Give it a few minutes." },
      { status: 429 },
    );
  }

  const admin = createAdminClient();

  const { data: rows } = await admin
    .from("agents")
    .select("*")
    .eq("user_id", session.userId)
    .eq("paused", false)
    .order("created_at", { ascending: true });

  // Already-deployed agents are skipped rather than redeployed. "Launch the
  // army" on an account that is mostly launched should finish the job, not
  // rebuild twenty-four working deployments to add one.
  const agents = ((rows ?? []) as Agent[]).filter(
    (agent) => agent.status !== "deployed" && agent.status !== "deploying",
  );

  if (!agents.length) {
    return NextResponse.json({
      deployed: 0,
      remaining: 0,
      done: true,
      failed: [],
      message: "Every agent is already live.",
    });
  }

  // Pre-flight the account before spending anything. See the note above: a
  // ceiling discovered halfway through is the failure this exists to prevent.
  try {
    const vercel = await vercelClientFor(session.userId);
    const held = await vercel.countProjects();
    const room = PROJECT_CEILING - RESERVE - held;

    if (room < agents.length) {
      return NextResponse.json(
        {
          error:
            `This launch needs ${agents.length} Vercel projects and there is room for ${Math.max(room, 0)}. ` +
            `The hosting account holds ${held} of a ${PROJECT_CEILING} ceiling. ` +
            `Free some projects or raise VERCEL_PROJECT_CEILING if the plan allows more.`,
          code: "vercel_capacity",
          held,
          needed: agents.length,
        },
        { status: 409 },
      );
    }
  } catch (cause) {
    // A token that cannot even list projects will not deploy either, and
    // saying so now is better than twenty-five identical failures.
    return NextResponse.json(
      {
        error:
          cause instanceof VercelError
            ? `Vercel rejected the platform token: ${cause.message}`
            : cause instanceof Error
              ? cause.message
              : "Could not reach Vercel.",
        code: "vercel_unreachable",
      },
      { status: 502 },
    );
  }

  const batch = agents.slice(0, BATCH);
  const failed: Failure[] = [];
  let deployed = 0;
  let stopped = false;

  for (const agent of batch) {
    try {
      await deployAgent(agent);
      deployed += 1;
    } catch (cause) {
      const reason =
        cause instanceof VercelError
          ? `Vercel said: ${cause.message}`
          : cause instanceof Error
            ? cause.message
            : "Deploy failed.";

      // Written to the agent, not only returned, so the founder sees it on that
      // agent's page tomorrow rather than in a toast that has gone.
      await admin
        .from("agents")
        .update({ status: "error", last_error: reason })
        .eq("id", agent.id);

      failed.push({ name: agent.name, reason });

      // A capacity or auth failure repeats for every remaining agent, so stop
      // rather than filing twenty more copies of the same error.
      if (cause instanceof VercelError && (cause.status === 402 || cause.status === 403)) {
        stopped = true;
        break;
      }
    }
  }

  const remaining = Math.max(agents.length - batch.length, 0);

  return NextResponse.json({
    deployed,
    remaining,
    // The client stops on `done`, and it must also stop when a batch produced
    // nothing but failures — otherwise it loops twelve times over the same
    // broken agent and reports the same error twelve times.
    done: stopped || remaining === 0 || deployed === 0,
    failed,
    message:
      failed.length === 0
        ? `${deployed} agents deployed.`
        : `${deployed} deployed, ${failed.length} could not: ${failed[0].reason}`,
  });
}
