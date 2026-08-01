import { NextResponse } from "next/server";
import { tick } from "@/core/scheduler";
import { verifyCronRequest } from "@/core/auth";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

/** Vercel Cron issues a GET. */
export async function GET(request: Request) {
  return handle(request);
}

/** Manual "run now" from the dashboard issues a POST. */
export async function POST(request: Request) {
  return handle(request);
}

async function handle(request: Request) {
  if (!verifyCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const outcome = await tick();
    if (!outcome.ran) {
      return NextResponse.json({ ran: false, reason: outcome.reason });
    }
    return NextResponse.json({
      ran: true,
      reason: outcome.reason,
      runId: outcome.result?.runId,
      ok: outcome.result?.ok,
      generations: outcome.result?.generations.length ?? 0,
      output: outcome.result?.output,
    });
  } catch (cause) {
    const error = cause instanceof Error ? cause.message : String(cause);
    console.error("[hermes] scheduled run failed:", error);
    return NextResponse.json({ ran: false, error }, { status: 500 });
  }
}
