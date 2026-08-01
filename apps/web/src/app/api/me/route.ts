import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hasPaid } from "@/lib/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Minimal "who am I, and have I paid" for the post-checkout poller. */
export async function GET() {
  const session = await getSession().catch(() => null);

  if (!session) {
    return NextResponse.json({ signedIn: false, paid: false }, { status: 200 });
  }

  return NextResponse.json({
    signedIn: true,
    paid: hasPaid(session.profile.plan),
    plan: session.profile.plan,
    agentQuota: session.profile.agent_quota,
    email: session.email,
  });
}
