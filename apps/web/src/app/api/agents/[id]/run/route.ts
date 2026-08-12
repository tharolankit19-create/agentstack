import { NextResponse } from "next/server";
import { requireOperatorApiUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AgentUnavailableError, callAgent } from "@/lib/agent-client";
import { requireTemplate } from "@/lib/templates";
import { rateLimit } from "@/lib/rate-limit";
import type { Agent } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * "Run now" — fires the agent's standing task without waiting for its cron.
 *
 * The run is recorded by the agent's own callback, not here, so a manual run
 * and a scheduled run land in the same place with the same shape.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireOperatorApiUser();
  if (!auth.ok) return auth.response;

  const { id } = await params;

  const limit = rateLimit(`run:${auth.session.userId}`, 20, 3600);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many manual runs this hour. The schedule still works." },
      { status: 429 },
    );
  }

  const supabase = await createClient();
  const { data: agent } = await supabase
    .from("agents")
    .select("*")
    .eq("id", id)
    .maybeSingle<Agent>();

  if (!agent) return NextResponse.json({ error: "Agent not found." }, { status: 404 });

  const template = requireTemplate(agent.template_id);

  try {
    const result = await callAgent(agent, "/api/run", {
      task: template.scheduledTask,
      trigger: "manual",
      settings: agent.config ?? {},
    });

    return NextResponse.json({
      ok: result.ok,
      output: result.reply,
      generations: result.generations.length,
      error: result.error ?? null,
    });
  } catch (cause) {
    if (cause instanceof AgentUnavailableError) {
      return NextResponse.json({ error: cause.message }, { status: 409 });
    }
    console.error("[run] failed:", cause);
    return NextResponse.json({ error: "The run failed." }, { status: 502 });
  }
}
