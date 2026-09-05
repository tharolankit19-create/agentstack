import "server-only";
import { createAdminClient } from "./supabase/admin";
import { HEAD_AGENT, rosterTemplateIds, memberFor } from "./army";
import { getTemplate } from "./templates";
import type { Agent } from "./supabase/types";

/**
 * Put the army on the board.
 *
 * The founder signs up and the twenty-five agents they were shown on the
 * landing page exist, named, running, with no button to find. That is the whole
 * promise of a hosted army: **we** run the agents, so there is nothing for the
 * founder to deploy, and a dashboard that opens on "Deploy your army" is
 * charging them for a product and then asking them to install it.
 *
 * Two properties make this safe to call from anywhere:
 *
 *   - **Idempotent.** It reads what exists and inserts only what is missing,
 *     and the partial unique index added in 0021 catches the case where two
 *     callers race — the auth callback and the first dashboard load, in two
 *     tabs. A duplicate insert is skipped, not surfaced as an error.
 *   - **Never destructive.** An agent the founder deleted stays deleted unless
 *     they ask for it back. `full: false` — the default for automatic calls —
 *     only enlists an account that has *no* agents at all, so an account that
 *     has been curated is left alone.
 *
 * `status` is `deployed` on purpose, and it is not a lie: under platform
 * hosting an agent is in service the moment its row exists, because the cron
 * fan-out selects on `paused = false` and runs it. There is no Vercel project
 * behind it and there does not need to be one.
 */

export interface EnlistResult {
  /** How many agents were created by this call. */
  created: number;
  /** How many were already there. */
  existing: number;
  /** Set when the insert was refused — the runaway guard, or the database. */
  error?: string;
}

export interface EnlistOptions {
  /** What the founder wants their head agent called. */
  headName?: string;
  /** Settings written onto the head agent, which every other agent inherits. */
  headConfig?: Record<string, string>;
  /**
   * Fill every gap in the roster, rather than only enlisting a fresh account.
   *
   * The automatic paths pass `false`: a founder who deleted eleven agents did
   * that deliberately, and an app that quietly puts them back is an app that
   * cannot be tidied. The explicit "enlist the rest" button passes `true`.
   */
  full?: boolean;
}

export async function enlistArmy(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  options: EnlistOptions = {},
): Promise<EnlistResult> {
  const { data: existingRows, error: readError } = await admin
    .from("agents")
    .select("template_id")
    .eq("user_id", userId);

  // A read that failed is not an empty account. Inserting twenty-five agents
  // on the strength of a network error is how a founder ends up with fifty.
  if (readError) return { created: 0, existing: 0, error: readError.message };

  const existing = new Set(
    ((existingRows ?? []) as Pick<Agent, "template_id">[]).map((row) => row.template_id),
  );

  if (existing.size > 0 && !options.full) {
    return { created: 0, existing: existing.size };
  }

  const wanted = rosterTemplateIds().filter((id) => !existing.has(id));
  if (wanted.length === 0) return { created: 0, existing: existing.size };

  const now = new Date().toISOString();

  const rows = wanted.flatMap((templateId) => {
    const template = getTemplate(templateId);
    if (!template) return [];
    const isHead = templateId === HEAD_AGENT.id;
    return [
      {
        user_id: userId,
        template_id: templateId,
        // Its name, not its job title. "Otis drafted five posts" is a
        // colleague; "Content Agent drafted five posts" is a log line.
        name:
          (isHead ? options.headName : undefined) ??
          memberFor(templateId)?.name ??
          template.name,
        status: "deployed" as const,
        deployed_at: now,
        config: isHead && options.headConfig ? options.headConfig : {},
      },
    ];
  });

  // One statement, head agent first — the roster is already ordered that way,
  // and if the runaway guard stops the insert partway the founder is left with
  // a commander and the top of the list rather than an arbitrary slice.
  const { data: inserted, error } = await admin
    .from("agents")
    .insert(rows)
    .select("template_id");

  if (!error) {
    return { created: inserted?.length ?? rows.length, existing: existing.size };
  }

  // A unique violation means someone else enlisted this account in the
  // milliseconds we spent deciding to. That is the index doing its job, and
  // the correct outcome is the one that already happened.
  if (error.code === "23505") {
    const { count } = await admin
      .from("agents")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    return { created: Math.max((count ?? 0) - existing.size, 0), existing: existing.size };
  }

  return { created: 0, existing: existing.size, error: error.message };
}

/**
 * Enlist without ever throwing, for the paths where enlistment is a side
 * effect rather than the request.
 *
 * A founder signing in must land on their dashboard whatever the agents table
 * says. So the callback and the layout call this: it reports the failure to the
 * server log and returns, and the next page load tries again.
 */
export async function enlistQuietly(userId: string): Promise<EnlistResult> {
  try {
    const result = await enlistArmy(createAdminClient(), userId);
    if (result.error) console.error("[enlist]", userId, result.error);
    return result;
  } catch (error) {
    console.error("[enlist]", userId, error);
    return { created: 0, existing: 0, error: String(error) };
  }
}
