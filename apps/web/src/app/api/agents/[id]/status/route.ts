import { NextResponse } from "next/server";
import { requirePaidApiUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isTerminal, VercelClient } from "@/lib/vercel";
import type { Agent } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Polls Vercel for a build's state and syncs it back to the agent row.
 *
 * The deploy page calls this while a build is running. Polling rather than
 * waiting on a Vercel webhook keeps the platform's public surface smaller —
 * there is no extra endpoint for anyone to find.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requirePaidApiUser();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const supabase = await createClient();
  const { data: agent } = await supabase
    .from("agents")
    .select("*")
    .eq("id", id)
    .maybeSingle<Agent>();

  if (!agent) return NextResponse.json({ error: "Agent not found." }, { status: 404 });

  if (!agent.vercel_deployment_id || agent.status !== "deploying") {
    return NextResponse.json({
      status: agent.status,
      url: agent.deploy_url,
      readyState: agent.status === "deployed" ? "READY" : null,
      error: agent.last_error,
    });
  }

  try {
    const deployment = await new VercelClient().getDeployment(
      agent.vercel_deployment_id,
    );
    const readyState = deployment.readyState.toUpperCase();

    if (!isTerminal(readyState)) {
      return NextResponse.json({ status: "deploying", readyState, url: null });
    }

    const admin = createAdminClient();

    if (readyState === "READY") {
      const url = deployment.url ?? agent.deploy_url;
      await admin
        .from("agents")
        .update({
          status: "deployed",
          deploy_url: url,
          deployed_at: new Date().toISOString(),
          last_error: null,
        })
        .eq("id", agent.id);

      return NextResponse.json({ status: "deployed", readyState, url });
    }

    const message =
      deployment.errorMessage ??
      `The build ended as ${readyState}. Check your keys and try again.`;

    await admin
      .from("agents")
      .update({ status: "error", last_error: message })
      .eq("id", agent.id);

    return NextResponse.json({ status: "error", readyState, error: message });
  } catch (cause) {
    console.error("[status] poll failed:", cause);
    return NextResponse.json(
      { status: "deploying", readyState: "UNKNOWN", url: null },
      { status: 200 },
    );
  }
}
