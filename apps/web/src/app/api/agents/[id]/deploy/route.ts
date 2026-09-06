import { NextResponse } from "next/server";
import { requireOperatorApiUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { deployAgent } from "@/lib/deploy";
import { rateLimit } from "@/lib/rate-limit";
import { VercelError } from "@/lib/vercel";
import type { Agent } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

/** Activates a built-in agent, or deploys a custom agent runtime. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireOperatorApiUser();
  if (!auth.ok) return auth.response;

  const { id } = await params;

  const supabase = await createClient();
  const { data: agent } = await supabase
    .from("agents")
    .select("*")
    .eq("id", id)
    .maybeSingle<Agent>();

  if (!agent) return NextResponse.json({ error: "Agent not found." }, { status: 404 });

  // The built-in army runs together in the app's shared runtime. Creating a
  // separate Vercel project for every specialist made activation fragile and
  // caused the dashboard to ask founders for deployment credentials it does
  // not need.
  if (!agent.custom_agent_id) {
    const { error } = await createAdminClient()
      .from("agents")
      .update({
        status: "deployed",
        paused: false,
        deployed_at: new Date().toISOString(),
        last_error: null,
      })
      .eq("id", agent.id);

    if (error) {
      return NextResponse.json(
        { error: "Could not activate this agent." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      deploymentId: null,
      url: null,
      readyState: "READY",
      shared: true,
    });
  }

  // Custom runtimes still get an isolated deployment and therefore retain a
  // conservative deployment budget.
  const limit = rateLimit(`deploy:${auth.session.userId}`, 12, 3600);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "That is a lot of deploys in an hour. Try again shortly." },
      { status: 429 },
    );
  }

  try {
    const outcome = await deployAgent(agent);
    return NextResponse.json({
      ok: true,
      deploymentId: outcome.deploymentId,
      url: outcome.url,
      readyState: outcome.readyState,
    });
  } catch (cause) {
    const message =
      cause instanceof VercelError
        ? `Vercel said: ${cause.message}`
        : cause instanceof Error
          ? cause.message
          : "Deploy failed.";

    console.error("[deploy] failed:", cause);

    // The failure is written to the agent so the customer sees it on the page,
    // not only in a toast that disappears.
    await createAdminClient()
      .from("agents")
      .update({ status: "error", last_error: message })
      .eq("id", agent.id);

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
