import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth";
import { startTrial, trialState, TrialError, TRIAL_MINUTES } from "@/lib/trial";
import { rateLimit } from "@/lib/rate-limit";
import { provisionArmy } from "@/lib/provision-army";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Turns a plan on immediately, for the trial window.
 *
 * Signed in but not paid — that is the whole point of it. Everything that
 * decides whether the grant is allowed lives in `startTrial`, including the
 * one-per-account rule, so this route stays a thin shell over it.
 */

const bodySchema = z.object({ plan: z.enum(["starter", "pro"]) });

export async function GET() {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  return NextResponse.json({
    ...trialState(auth.session.profile),
    minutes: TRIAL_MINUTES,
  });
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const limit = rateLimit(`trial:${auth.session.userId}`, 8, 600);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Wait a minute." },
      { status: 429 },
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Pick a plan." }, { status: 400 });
  }

  try {
    const { profile, plan } = await startTrial(auth.session.userId, parsed.data.plan);
    try { await provisionArmy(auth.session.userId, true); }
    catch (cause) {
      console.error("[trial] army setup incomplete", cause);
      return NextResponse.json({ ok: true, warning: "Your trial started. Use Start my army to finish activating your saved team." });
    }
    return NextResponse.json({
      ok: true,
      plan: plan.tier,
      quota: plan.agentQuota,
      minutes: TRIAL_MINUTES,
      ...trialState(profile),
    });
  } catch (cause) {
    // TrialError messages are written for the customer to read as-is.
    if (cause instanceof TrialError) {
      return NextResponse.json({ error: cause.message }, { status: 409 });
    }
    console.error("[trial] failed:", cause);
    return NextResponse.json({ error: "Could not start that." }, { status: 500 });
  }
}
