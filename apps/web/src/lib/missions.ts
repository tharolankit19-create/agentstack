import "server-only";
import { createAdminClient } from "./supabase/admin";
import { displayName } from "./army";
import { getTemplate } from "./templates";
import type { Agent, Generation, ScheduledTask, AgentActivity } from "./supabase/types";
import type { Mission } from "./missions-shared";

// Re-exported so every existing import of `@/lib/missions` keeps working; the
// definitions live in the client-safe module next door.
export { LANES, inLane } from "./missions-shared";
export type { Lane, MissionKind, Mission } from "./missions-shared";

type Admin = ReturnType<typeof createAdminClient>;

/**
 * Everything the army is doing, as one board.
 *
 * The work was real and the founder could not see it. Drafts sat in
 * `generations`, written cold emails sat in `leads`, "at 5pm do X" sat in
 * `scheduled_tasks`, and whatever an agent was doing right now sat in
 * `agent_activity` — four tables, four half-views, and no single answer to the
 * only two questions a founder actually has: what is happening, and what needs
 * me.
 *
 * A mission is one unit of work in one of four lanes. The lanes are ordered by
 * how much they cost the founder to ignore:
 *
 *   needs_you  Blocked on a human. An approval, a decision, an answer only
 *              they can give. Nothing behind it moves until they act.
 *   in_flight  An agent is on it right now.
 *   queued     Scheduled, nobody has picked it up yet.
 *   done       Finished today.
 *
 * "Needs you" comes first everywhere and is never collapsed, because the whole
 * proposition is that the founder is a bottleneck for approvals and nothing
 * else. A board that buries the four things waiting on them under thirty things
 * that are not is a board that makes them the bottleneck for everything.
 */

/** The first line with real words in it — headings and labels make bad titles. */
function titleOf(content: string, fallback: string): string {
  const line = content
    .split("\n")
    .map((l) => l.replace(/^[#>*\-\s]+/, "").replace(/\*\*/g, "").trim())
    .find((l) => l.length > 12);

  return (line ?? fallback).slice(0, 90);
}

/**
 * Read the board.
 *
 * One pass over four tables rather than a query per lane. The alternative —
 * letting each lane fetch itself — reads cleanly and produces a board where the
 * columns describe four different instants, so a mission can appear in two
 * lanes at once as it moves between them while the page is loading.
 */
export async function loadMissions(admin: Admin, userId: string): Promise<Mission[]> {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  const today = since.toISOString();

  const [{ data: agentRows }, { data: gens }, { data: tasks }, { data: activity }, { data: leads }] =
    await Promise.all([
      admin.from("agents").select("id, template_id, name").eq("user_id", userId),
      admin
        .from("generations")
        .select("id, agent_id, kind, content, approved, created_at")
        .eq("user_id", userId)
        .or(`approved.eq.false,created_at.gte.${today}`)
        .order("created_at", { ascending: false })
        .limit(120),
      admin
        .from("scheduled_tasks")
        .select("*")
        .eq("user_id", userId)
        .in("status", ["pending", "done"])
        .order("run_at", { ascending: true })
        .limit(40),
      admin
        .from("agent_activity")
        .select("*")
        .eq("user_id", userId)
        .gt("expires_at", new Date().toISOString())
        .limit(20),
      admin
        .from("leads")
        .select("id, stage, full_name, company, email_subject, updated_at, sent_at")
        .eq("user_id", userId)
        .in("stage", ["written", "sent"])
        .order("updated_at", { ascending: false })
        .limit(60),
    ]);

  const agents = (agentRows ?? []) as Pick<Agent, "id" | "template_id" | "name">[];
  const nameFor = (agentId: string | null) => {
    const agent = agents.find((a) => a.id === agentId);
    if (!agent) return { name: null, templateId: null };
    return {
      name: displayName(agent.template_id, agent.name, getTemplate(agent.template_id)?.name),
      templateId: agent.template_id,
    };
  };

  const missions: Mission[] = [];

  // Drafts. Unapproved is the founder's move; approved-today is a receipt.
  for (const row of (gens ?? []) as Generation[]) {
    const who = nameFor(row.agent_id);
    const waiting = !row.approved;

    // A briefing is a message that was already delivered, not a thing to
    // approve. Listing it as "needs you" would put a permanent unactionable
    // item at the top of the board every single morning.
    if (row.kind === "briefing" && waiting) continue;

    missions.push({
      id: `gen:${row.id}`,
      lane: waiting ? "needs_you" : "done",
      kind: "draft",
      title: titleOf(row.content, "A draft"),
      detail: who.name ? `${who.name} · ${row.kind}` : row.kind,
      agentName: who.name,
      agentTemplateId: who.templateId,
      // Straight to the work, not to the agent's settings page. `#work` is
      // the drafts section; the config form used to be the first thing on
      // screen, so every mission click looked like it had gone wrong.
      href: `/dashboard/agents/${row.agent_id}#work`,
      at: row.created_at,
      asks: waiting ? "approval" : null,
      generationId: row.id,
      agentId: row.agent_id,
    });
  }

  // Written cold emails are the sharpest "needs you" there is: a real person is
  // named, the email exists, and nothing happens until the founder says yes.
  for (const lead of (leads ?? []) as {
    id: string;
    stage: string;
    full_name: string | null;
    company: string | null;
    email_subject: string | null;
    updated_at: string;
    sent_at: string | null;
  }[]) {
    const who = [lead.full_name, lead.company].filter(Boolean).join(" · ") || "a lead";
    const sent = lead.stage === "sent";

    missions.push({
      id: `lead:${lead.id}`,
      lane: sent ? "done" : "needs_you",
      kind: "outreach",
      title: lead.email_subject || `Cold email to ${who}`,
      detail: sent ? `Sent to ${who}` : `Written for ${who} — waiting on you`,
      agentName: null,
      agentTemplateId: "outreach-agent",
      href: "/dashboard/leads",
      at: lead.sent_at ?? lead.updated_at,
      asks: sent ? null : "approval",
    });
  }

  for (const task of (tasks ?? []) as ScheduledTask[]) {
    const who = nameFor(task.agent_id);
    missions.push({
      id: `task:${task.id}`,
      lane: task.status === "done" ? "done" : "queued",
      kind: "task",
      title: task.instruction.slice(0, 90),
      detail: task.when_label ? `You asked for this ${task.when_label}` : "Scheduled by you",
      agentName: who.name,
      agentTemplateId: who.templateId,
      href: "/dashboard/scheduled",
      at: task.ran_at ?? task.run_at,
      asks: null,
    });
  }

  // What is happening right now. Short-lived by design — these expire on their
  // own, so the lane empties itself rather than accumulating ghosts.
  for (const row of (activity ?? []) as AgentActivity[]) {
    const template = getTemplate(row.template_id);
    missions.push({
      id: `act:${row.id}`,
      lane: "in_flight",
      kind: "working",
      title: row.label,
      detail: template?.name ?? null,
      agentName: displayName(row.template_id, null, template?.name),
      agentTemplateId: row.template_id,
      href: row.agent_id ? `/dashboard/agents/${row.agent_id}` : "/dashboard/agents",
      at: row.started_at,
      asks: null,
    });
  }

  // Newest first within a lane, except the queue, which is a timetable and
  // reads backwards if the soonest thing is at the bottom.
  return missions.sort((a, b) => {
    if (a.lane === "queued" && b.lane === "queued") {
      return Date.parse(a.at) - Date.parse(b.at);
    }
    return Date.parse(b.at) - Date.parse(a.at);
  });
}


/** Missions in one lane, capped so a busy day cannot make the page unusable. */

/** The one number that belongs in a nav badge and a push notification. */
export function needsYouCount(missions: Mission[]): number {
  return missions.filter((m) => m.lane === "needs_you").length;
}
