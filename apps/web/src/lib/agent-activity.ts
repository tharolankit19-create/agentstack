import "server-only";
import { createAdminClient } from "./supabase/admin";
import { displayName, memberFor } from "./army";
import { getTemplate } from "./templates";
import type { AgentActivity } from "./supabase/types";

/**
 * The live pulse of the army — who is working, right now.
 *
 * Work on this platform is a fast server call: a founder sends a message, the
 * head agent researches and answers in a few seconds, and it is over before a
 * dashboard poll could catch it. So instead of inferring activity after the
 * fact, the code that does the work announces it: it drops a short-lived marker
 * here as it starts, and the dashboard reads the unexpired ones.
 *
 * The markers are deliberately cheap and self-cleaning. Each one carries a human
 * label and lives for a minute or two; expired rows are ignored on read and
 * swept on the next write, so the table never grows.
 */

type Admin = ReturnType<typeof createAdminClient>;

/**
 * Announce that an agent has started something.
 *
 * `templateId` is always known ("research-agent"); `agentId` is passed when the
 * agent is actually deployed, and left null for a squad role the head agent is
 * orchestrating on the founder's behalf. Never throws — a failed marker must not
 * break the work it was announcing.
 */
export async function markWorking(
  admin: Admin,
  userId: string,
  templateId: string,
  label: string,
  seconds = 40,
  agentId: string | null = null,
): Promise<void> {
  try {
    await admin.from("agent_activity").insert({
      user_id: userId,
      agent_id: agentId,
      template_id: templateId,
      label,
      expires_at: new Date(Date.now() + seconds * 1000).toISOString(),
    });
    // Opportunistic cleanup: drop this founder's stale rows so the table stays
    // tiny without a separate cron.
    await admin
      .from("agent_activity")
      .delete()
      .eq("user_id", userId)
      .lt("expires_at", new Date(Date.now() - 60_000).toISOString());
  } catch {
    // Activity is a nice-to-have signal; losing one is invisible to the founder.
  }
}

export interface WorkingAgent {
  templateId: string;
  agentId: string | null;
  name: string;
  label: string;
}

/**
 * The agents this founder has working right now, freshest first.
 *
 * Resolves each marker's name the same way the roster does, so the face and the
 * name on the dashboard match everywhere. Deduplicated by template — an agent
 * that dropped two markers in quick succession shows once, with its latest
 * label.
 */
export async function workingAgents(
  admin: Admin,
  userId: string,
): Promise<WorkingAgent[]> {
  const { data } = await admin
    .from("agent_activity")
    .select("agent_id, template_id, label, expires_at")
    .eq("user_id", userId)
    .gt("expires_at", new Date().toISOString())
    .order("started_at", { ascending: false })
    .limit(12);

  const seen = new Set<string>();
  const out: WorkingAgent[] = [];
  for (const row of (data ?? []) as Pick<
    AgentActivity,
    "agent_id" | "template_id" | "label"
  >[]) {
    if (seen.has(row.template_id)) continue;
    seen.add(row.template_id);
    const template = getTemplate(row.template_id);
    out.push({
      templateId: row.template_id,
      agentId: row.agent_id,
      name:
        memberFor(row.template_id)?.name ??
        displayName(row.template_id, null, template?.name),
      label: row.label,
    });
  }
  return out;
}
