import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOperatorApiUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { vercelClientFor } from "@/lib/user-hosting";
import type { Agent } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ paused: z.boolean() });

/**
 * The Stop/Start toggle.
 *
 * Flipping AGENT_PAUSED on the deployment makes the running agent refuse its
 * next scheduled tick. The database is updated either way, so the switch is
 * never stuck on because Vercel had a bad minute — worst case the deployment
 * catches up on the next deploy.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireOperatorApiUser();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: agent } = await supabase
    .from("agents")
    .select("*")
    .eq("id", id)
    .maybeSingle<Agent>();

  if (!agent) return NextResponse.json({ error: "Agent not found." }, { status: 404 });

  const { error } = await supabase
    .from("agents")
    .update({ paused: parsed.data.paused })
    .eq("id", agent.id);

  if (error) {
    return NextResponse.json({ error: "Could not change that." }, { status: 500 });
  }

  let liveEffect = false;
  if (agent.vercel_project_id) {
    try {
      const vercel = await vercelClientFor(agent.user_id);
      await vercel.replaceProjectEnv(agent.vercel_project_id, [
        { key: "AGENT_PAUSED", value: parsed.data.paused ? "true" : "false" },
      ]);
      liveEffect = true;
    } catch (cause) {
      console.error("[toggle] could not update the deployment env:", cause);
    }
  }

  return NextResponse.json({
    ok: true,
    paused: parsed.data.paused,
    // Vercel reads env at invocation, so the change lands on the next run.
    appliesOnNextRun: liveEffect,
  });
}
