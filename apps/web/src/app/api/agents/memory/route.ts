import { NextResponse } from "next/server";
import { authenticateAgent } from "@/lib/agent-auth";
import { memoryFor } from "@/lib/learning";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PromptRevision } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * What an agent knows, fetched at the start of every run.
 *
 * This is the read half of the loop whose write half is the callback. An agent
 * boots, asks this endpoint what it concluded last time, prepends the answer
 * to its prompt, does the work, and reports new conclusions on the way out.
 *
 * It is a runtime fetch rather than an environment variable baked in at deploy
 * time on purpose: memory that only updated on redeploy would be a month stale
 * for an agent that runs daily and is redeployed twice a year.
 *
 * An agent can only ever read its own memory plus the anonymised shared
 * playbook. The agent id comes from the authenticated token, not the request.
 */
export async function GET(request: Request) {
  const identity = await authenticateAgent(request);
  if (!identity) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const memory = await memoryFor(identity.agentId, identity.templateId);

  // Any prompt the agent previously rewrote *and the customer switched on*.
  // Inactive revisions are proposals and are deliberately not returned — an
  // agent that could read back its own unapproved drafts would treat them as
  // instructions, which is the exact failure the approval step exists to stop.
  const admin = createAdminClient();
  const { data: revisions } = await admin
    .from("agent_prompt_revisions")
    .select("prompt_name, body, version")
    .eq("agent_id", identity.agentId)
    .eq("active", true);

  const prompts = Object.fromEntries(
    ((revisions ?? []) as Pick<PromptRevision, "prompt_name" | "body" | "version">[]).map(
      (row) => [row.prompt_name, { body: row.body, version: row.version }],
    ),
  );

  return NextResponse.json({
    brief: memory.brief,
    notes: memory.own.map((note) => ({
      kind: note.kind,
      key: note.key,
      summary: note.summary,
      observations: note.observations,
      score: note.score,
    })),
    playbook: memory.shared.map((entry) => ({
      kind: entry.kind,
      lesson: entry.lesson,
      teams: entry.users_seen,
    })),
    prompts,
  });
}
