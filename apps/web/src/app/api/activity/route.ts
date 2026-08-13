import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { displayName } from "@/lib/army";
import { getTemplate } from "@/lib/templates";
import { workingAgents } from "@/lib/agent-activity";
import type { Agent, Generation } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Who's working, and what just landed.
 *
 * The dashboard polls this to answer the one question a founder actually asks —
 * "is anything happening right now?" — and to name the agents doing it. Two
 * signals: the live markers agents drop as they work (the real "working now",
 * with a human label), and the trail of what recently landed, so a quiet moment
 * shows the last thing that happened rather than an empty box.
 */

export interface ActivityItem {
  agentId: string | null;
  name: string;
  templateId: string;
  kind: string;
  at: string;
}

export interface WorkingItem {
  templateId: string;
  agentId: string | null;
  name: string;
  label: string;
}

export async function GET() {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const admin = createAdminClient();

  const [working, { data: gens }, { data: agents }] = await Promise.all([
    workingAgents(admin, auth.session.userId),
    admin
      .from("generations")
      .select("agent_id, kind, created_at")
      .eq("user_id", auth.session.userId)
      .order("created_at", { ascending: false })
      .limit(6),
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

  const recent: ActivityItem[] = [];
  for (const gen of (gens ?? []) as Pick<
    Generation,
    "agent_id" | "kind" | "created_at"
  >[]) {
    const agent = byId.get(gen.agent_id);
    if (!agent) continue;
    const template = getTemplate(agent.template_id);
    recent.push({
      agentId: agent.id,
      name: displayName(agent.template_id, agent.name, template?.name),
      templateId: agent.template_id,
      kind: gen.kind,
      at: gen.created_at,
    });
  }

  return NextResponse.json({ working, recent });
}
