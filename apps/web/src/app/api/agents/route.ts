import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePaidApiUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { requireTemplate, TEMPLATES } from "@/lib/templates";
import type { Agent } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  templateId: z.string().min(1).max(60),
  name: z.string().min(1).max(80).optional(),
});

/** Creates an agent instance from a template. */
export async function POST(request: Request) {
  const auth = await requirePaidApiUser();
  if (!auth.ok) return auth.response;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Pick an agent to create." }, { status: 400 });
  }

  let template;
  try {
    template = requireTemplate(parsed.data.templateId);
  } catch {
    return NextResponse.json(
      { error: `Unknown agent. Choose one of: ${TEMPLATES.map((t) => t.name).join(", ")}.` },
      { status: 400 },
    );
  }

  const supabase = await createClient();

  // One agent per template keeps the dashboard honest: the card the customer
  // clicked is the agent they get.
  const { data: existing } = await supabase
    .from("agents")
    .select("id")
    .eq("template_id", template.id)
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

/** Lists the customer's agents. */
export async function GET() {
  const auth = await requirePaidApiUser();
  if (!auth.ok) return auth.response;

  const supabase = await createClient();
  const { data } = await supabase
    .from("agents")
    .select("*")
    .order("created_at", { ascending: true });

  return NextResponse.json({ agents: data ?? [] });
}
