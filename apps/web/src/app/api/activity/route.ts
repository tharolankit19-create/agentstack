import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { displayName } from "@/lib/army";
import { getTemplate } from "@/lib/templates";
import type { Agent, Generation } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Who's working, and what just landed.
 *
 * The dashboard polls this to answer one question the founder actually asks —
 * "is anything happening right now?" — and to name the agent doing it. An agent
 * that produced something in the last couple of minutes is shown as working;
 * everything recent past that is the trail of what already happened.
 *
 * Cheap on purpose: one query, capped small, read-only. It is hit every few
 * seconds by an open dashboard, so it does no work beyond a single select.
 */

/** How fresh a generation has to be to count as "working right now". */
const WORKING_WINDOW_MS = 90_000;

export interface ActivityItem {
  agentId: string;
  name: string;
  role: string | null;
  templateId: string;
  kind: string;
  at: string;
  working: boolean;
}

export async function GET() {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const admin = createAdminClient();

  const [{ data: gens }, { data: agents }] = await Promise.all([
    admin
      .from("generations")
      .select("agent_id, kind, created_at")
      .eq("user_id", auth.session.userId)
      .order("created_at", { ascending: false })
      .limit(8),
    admin
      .from("agents")
      .select("id, name, template_id")
      .eq("user_id", auth.session.userId),
  ]);

  const byId = new Map(
    ((agents ?? []) as Pick<Agent, "id" | "name" | "template_id">[]).map((a) => [
      a.id,
      a,
    ]),
  );

  const now = Date.now();
  const items: ActivityItem[] = [];
  for (const gen of (gens ?? []) as Pick<
    Generation,
    "agent_id" | "kind" | "created_at"
  >[]) {
    const agent = byId.get(gen.agent_id);
    if (!agent) continue;
    const template = getTemplate(agent.template_id);
    items.push({
      agentId: agent.id,
      name: displayName(agent.template_id, agent.name, template?.name),
      role: template?.name ?? null,
      templateId: agent.template_id,
      kind: gen.kind,
      at: gen.created_at,
      working: now - new Date(gen.created_at).getTime() < WORKING_WINDOW_MS,
    });
  }

  return NextResponse.json({ items });
}
