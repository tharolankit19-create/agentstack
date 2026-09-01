import "server-only";
import { createAdminClient } from "./supabase/admin";
import { WORKERS } from "./heartbeat";
import { houseModelKey, loadConnectors, houseMonidKey } from "./connectors";
import { whoami } from "./monid";
import { userEntitled } from "./entitlement";
import { getTemplate } from "./templates";
import { isDue } from "./cadence";
import type { Agent, CronTick } from "./supabase/types";

type Admin = ReturnType<typeof createAdminClient>;

/**
 * "Why is nothing happening?" — answered from the actual state, not guessed.
 *
 * This is the question the product has been failing at worst. When the army
 * goes quiet there is nothing to look at: the dashboard renders, chat replies,
 * the agent cards say "deployed", and no work appears. The founder cannot tell
 * a stopped scheduler from a missing model key from an empty trial, and neither
 * could anyone helping them.
 *
 * So the checks live in one place and are worded for the person who has to act.
 * Each one names what is wrong and what to do about it, in that order, and the
 * blockers come first because a stopped clock makes every other observation
 * meaningless — an agent that "has not run" is not broken if nothing has asked
 * it to run.
 */

export type Severity = "blocker" | "warning" | "ok";

export interface Check {
  severity: Severity;
  /** What is true, in the founder's words. */
  title: string;
  /** What to do about it. Null when nothing needs doing. */
  fix: string | null;
}

export interface Diagnosis {
  /** True when nothing is blocking the army from working. */
  healthy: boolean;
  checks: Check[];
}

/** The clock: has anything called the heartbeat, and is any worker overdue? */
async function checkClock(admin: Admin): Promise<Check> {
  const { data, error } = await admin.from("cron_ticks").select("worker, last_run_at, updated_at");

  if (error) {
    return {
      severity: "blocker",
      title: "The scheduler table is missing, so nothing can be scheduled.",
      fix: "Run the latest migrations (or paste supabase/schema.sql into the Supabase SQL editor).",
    };
  }

  const ticks = (data ?? []) as CronTick[];
  const ran = ticks.filter((t) => t.last_run_at);

  if (!ran.length) {
    return {
      severity: "blocker",
      title: "Nothing has ever called the heartbeat — the army has never been asked to work.",
      fix:
        "Start the clock: run the internal scheduler SQL (supabase/migrations/0017_internal_scheduler.sql) " +
        "and set your app URL in agentstack.scheduler_config. Step 8 of docs/SETUP.md.",
    };
  }

  const now = Date.now();
  const stalled = WORKERS.filter((w) => {
    const last = ticks.find((t) => t.worker === w.name)?.last_run_at;
    return !last || now - Date.parse(last) > w.everyMinutes * 4 * 60_000;
  });

  if (stalled.length) {
    const newest = Math.max(...ran.map((t) => Date.parse(t.last_run_at!)));
    const minutes = Math.round((now - newest) / 60_000);
    return {
      severity: "blocker",
      title: `The clock has stopped — last heartbeat was ${minutes} minutes ago (${stalled
        .map((w) => w.name)
        .join(", ")} overdue).`,
      fix: "Whatever calls /api/cron/heartbeat has stopped. Check the scheduler, then hit it once with ?force=1.",
    };
  }

  return { severity: "ok", title: "The clock is beating and every worker is on time.", fix: null };
}

/** The model key: without one, every agent fails silently. */
async function checkModel(admin: Admin): Promise<Check> {
  const key = await houseModelKey(admin);
  return key
    ? { severity: "ok", title: "A model key is configured.", fix: null }
    : {
        severity: "blocker",
        title: "There is no model key, so no agent can think.",
        fix: "Add an OpenRouter key on the Connectors page, or set OPENROUTER_API_KEY.",
      };
}

/** This founder's own situation: entitlement, agents, recent output. */
async function checkFounder(admin: Admin, userId: string): Promise<Check[]> {
  const checks: Check[] = [];

  if (!(await userEntitled(admin, userId))) {
    checks.push({
      severity: "blocker",
      title: "Your trial has ended and no plan is active, so the squads are paused.",
      fix: "Pick a plan in the dashboard and they start again on the next tick.",
    });
    return checks;
  }

  const { data: rows } = await admin
    .from("agents")
    .select("id, template_id, paused, last_run_at")
    .eq("user_id", userId);

  const agents = (rows ?? []) as Pick<Agent, "id" | "template_id" | "paused" | "last_run_at">[];

  if (!agents.length) {
    checks.push({
      severity: "blocker",
      title: "You have no agents yet.",
      fix: "Open the dashboard and start your army — it takes one button.",
    });
    return checks;
  }

  const active = agents.filter((a) => !a.paused);
  if (!active.length) {
    checks.push({
      severity: "blocker",
      title: `All ${agents.length} of your agents are paused.`,
      fix: "Unpause them on the Agents page.",
    });
    return checks;
  }

  // Overdue means the clock ran but this agent still did not work — a different
  // failure from a stopped clock, and worth separating so the fix is different.
  const overdue = active.filter((a) => {
    const template = getTemplate(a.template_id);
    if (!template?.scheduledTask) return false;
    if (!a.last_run_at) return true;
    // Twice its own interval: one missed turn is a slow tick, two is a pattern.
    return isDue(template.frequency, a.last_run_at) && Date.now() - Date.parse(a.last_run_at) >
      2 * 60 * 60_000;
  });

  if (overdue.length === active.length) {
    checks.push({
      severity: "warning",
      title: `All ${active.length} agents are past due — they are scheduled but not producing.`,
      fix: "Usually the model key or the clock. If both are green above, check the run logs.",
    });
  } else if (overdue.length) {
    checks.push({
      severity: "warning",
      title: `${overdue.length} of ${active.length} agents are past due.`,
      fix: "The rest are working, so this is likely per-agent config rather than the platform.",
    });
  } else {
    checks.push({
      severity: "ok",
      title: `${active.length} agents are active and on schedule.`,
      fix: null,
    });
  }

  const since = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
  const { count } = await admin
    .from("generations")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", since);

  checks.push(
    (count ?? 0) > 0
      ? { severity: "ok", title: `${count} pieces of work in the last 24 hours.`, fix: null }
      : {
          severity: "warning",
          title: "Nothing has been produced in the last 24 hours.",
          fix: "If the checks above are green, the next tick should produce something.",
        },
  );

  return checks;
}

/**
 * What the squads can reach — and, for Monid, whether the key actually works.
 *
 * A key that is present and a key that is valid are different states, and the
 * gap between them is where a founder loses an afternoon: the connectors page
 * shows a green tick because a string is on file, while every run fails on a
 * 401 nobody sees. `whoami` costs nothing and settles it, so a pasted-wrong key
 * is caught the first time anyone asks rather than the first time it matters.
 */
async function checkReach(admin: Admin, userId: string): Promise<Check[]> {
  const connectors = await loadConnectors(admin, userId);
  const monidKey = connectors.monid ?? (await houseMonidKey(admin));

  const checks: Check[] = [];
  const have: string[] = [];

  if (monidKey) {
    const valid = await whoami(monidKey).catch(() => false);
    if (valid) {
      have.push("Monid");
    } else {
      checks.push({
        severity: "warning",
        title: "The Monid key is on file but Monid rejected it.",
        fix: "Generate a fresh key at app.monid.ai/access/api-keys and paste it on the Connectors page.",
      });
    }
  }

  if (connectors.firecrawl) have.push("Firecrawl");
  if (connectors.x) have.push("X");
  if (connectors.apollo) have.push("Apollo");

  checks.push(
    have.length
      ? { severity: "ok", title: `Live data: ${have.join(", ")}.`, fix: null }
      : {
          severity: "warning",
          title: "No working data connectors, so the squads write from memory rather than this week.",
          fix: "Connect Monid on the Connectors page — one key covers leads, social and reviews.",
        },
  );

  return checks;
}

/**
 * The full picture for one founder.
 *
 * Platform checks first, then theirs. A founder reading this should be able to
 * stop at the first blocker and know exactly what to do.
 */
export async function diagnose(userId: string): Promise<Diagnosis> {
  const admin = createAdminClient();

  const [clock, model, reach, founder] = await Promise.all([
    checkClock(admin),
    checkModel(admin),
    checkReach(admin, userId),
    checkFounder(admin, userId),
  ]);

  const checks = [clock, model, ...founder, ...reach];
  const order: Record<Severity, number> = { blocker: 0, warning: 1, ok: 2 };
  checks.sort((a, b) => order[a.severity] - order[b.severity]);

  return { healthy: !checks.some((c) => c.severity === "blocker"), checks };
}

/**
 * The diagnosis as a Telegram message.
 *
 * Plain text, no markdown — the head agent's whole voice is a message on a
 * phone, and a wall of asterisks reads like a status page from a vendor.
 */
export function diagnosisText(diagnosis: Diagnosis): string {
  const lines: string[] = [];

  lines.push(
    diagnosis.healthy
      ? "Everything checks out. Here is the state:"
      : "Something is stopping the work. Here is what I found:",
  );
  lines.push("");

  for (const check of diagnosis.checks) {
    const mark = check.severity === "blocker" ? "✗" : check.severity === "warning" ? "!" : "✓";
    lines.push(`${mark} ${check.title}`);
    if (check.fix) lines.push(`   → ${check.fix}`);
  }

  return lines.join("\n");
}
