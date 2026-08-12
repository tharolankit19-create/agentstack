import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOperatorApiUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { requireTemplate, TEMPLATES } from "@/lib/templates";
import type { Agent } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  templateId: z.string().min(1).max(60).optional(),
  customAgentId: z.string().uuid().optional(),
  name: z.string().min(1).max(80).optional(),
});

/** Creates an agent instance, from a catalog template or a generated spec. */
export async function POST(request: Request) {
  const auth = await requireOperatorApiUser();
  if (!auth.ok) return auth.response;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || (!parsed.data.templateId && !parsed.data.customAgentId)) {
    return NextResponse.json({ error: "Pick an agent to create." }, { status: 400 });
  }

  const supabase = await createClient();

  if (parsed.data.customAgentId) {
    return createFromCustom(
      supabase,
      auth.session.userId,
      parsed.data.customAgentId,
      parsed.data.name,
    );
  }

  let template;
  try {
    template = requireTemplate(parsed.data.templateId!);
  } catch {
    return NextResponse.json(
      { error: `Unknown agent. Choose one of: ${TEMPLATES.map((t) => t.name).join(", ")}.` },
      { status: 400 },
    );
  }

  // One agent per template keeps the dashboard honest: the card the customer
  // clicked is the agent they get.
  const { data: existing } = await supabase
    .from("agents")
    .select("id")
    .eq("template_id", template.id)
    .is("custom_agent_id", null)
    .maybeSingle<{ id: string }>();

  if (existing) return NextResponse.json({ id: existing.id, existing: true });

  const defaults: Record<string, string> = {};
  for (const spec of template.settings) {
    if (spec.default) defaults[spec.key] = spec.default;
  }

  const { data, error } = await supabase
    .from("agents")
    .insert({
      user_id: auth.session.userId,
      template_id: template.id,
      name: parsed.data.name ?? template.name,
      status: "draft",
      config: defaults,
    })
    .select("id")
    .single<Pick<Agent, "id">>();

  if (error) {
    // The quota trigger raises check_violation with a message worth showing.
    const quotaHit = error.message.includes("Agent limit") || error.code === "23514";
    return NextResponse.json(
      { error: quotaHit ? error.message : "Could not create that agent." },
      { status: quotaHit ? 403 : 500 },
    );
  }

  return NextResponse.json({ id: data.id }, { status: 201 });
}

/**
 * Creates an agent backed by a generated spec.
 *
 * These carry `template_id = "custom-agent"`, which is the id the runtime uses
 * to load from `CUSTOM_AGENT_SPEC` instead of from disk. Unlike catalog
 * agents there is no one-per-template rule — replacing four of your own tools
 * means four custom agents.
 */
async function createFromCustom(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  customAgentId: string,
  name?: string,
) {
  const { data: custom } = await supabase
    .from("custom_agents")
    .select("id, status, spec, source_name")
    .eq("id", customAgentId)
    .maybeSingle<{
      id: string;
      status: string;
      spec: { name?: string } | null;
      source_name: string | null;
    }>();

  if (!custom) {
    return NextResponse.json({ error: "That build was not found." }, { status: 404 });
  }
  if (custom.status !== "ready" || !custom.spec) {
    return NextResponse.json(
      { error: "That agent is still being built. Give it a moment." },
      { status: 409 },
    );
  }

  const { data: existing } = await supabase
    .from("agents")
    .select("id")
    .eq("custom_agent_id", custom.id)
    .maybeSingle<{ id: string }>();

  if (existing) return NextResponse.json({ id: existing.id, existing: true });

  const { data, error } = await supabase
    .from("agents")
    .insert({
      user_id: userId,
      template_id: "custom-agent",
      custom_agent_id: custom.id,
      name: name ?? custom.spec.name ?? `${custom.source_name} Agent`,
      status: "draft",
      config: {},
    })
    .select("id")
    .single<Pick<Agent, "id">>();

  if (error) {
    const quotaHit = error.message.includes("Agent limit") || error.code === "23514";
    return NextResponse.json(
      { error: quotaHit ? error.message : "Could not create that agent." },
      { status: quotaHit ? 403 : 500 },
    );
  }

  return NextResponse.json({ id: data.id }, { status: 201 });
}

/** Lists the customer's agents. */
export async function GET() {
  const auth = await requireOperatorApiUser();
  if (!auth.ok) return auth.response;

  const supabase = await createClient();
  const { data } = await supabase
    .from("agents")
    .select("*")
    .order("created_at", { ascending: true });

  return NextResponse.json({ agents: data ?? [] });
}
