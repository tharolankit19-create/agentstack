import { runAgent } from "./agent";
import { loadTemplate } from "@/templates/loader";
import { reportRun } from "./telemetry";
import type { RunResult } from "./types";

/**
 * Cron job runner.
 *
 * Vercel Cron pings `/api/schedule` on the template's schedule; this module
 * decides whether the tick should actually do work. Two gates:
 *
 *   - AGENT_PAUSED, so the founder's Stop toggle takes effect without a
 *     redeploy or a cron edit.
 *   - The founder's own frequency setting, which is coarser than the cron
 *     expression (a "Mondays only" agent still gets pinged every weekday).
 */

export interface ScheduleDecision {
  shouldRun: boolean;
  reason: string;
}

export function decide(
  frequency: string | undefined,
  now = new Date(),
): ScheduleDecision {
  if (isPaused()) return { shouldRun: false, reason: "agent is paused" };

  const day = now.getUTCDay(); // 0 = Sunday
  switch ((frequency ?? "").trim()) {
    case "Manual only":
      return { shouldRun: false, reason: "agent is set to manual runs only" };
    case "Mondays only":
      return day === 1
        ? { shouldRun: true, reason: "Monday" }
        : { shouldRun: false, reason: "set to Mondays only" };
    case "Every weekday 9am":
      return day >= 1 && day <= 5
        ? { shouldRun: true, reason: "weekday" }
        : { shouldRun: false, reason: "set to weekdays only" };
    default:
      return { shouldRun: true, reason: "on schedule" };
  }
}

export function isPaused(): boolean {
  return /^(1|true|yes)$/i.test(process.env.AGENT_PAUSED ?? "");
}

export interface TickResult {
  ran: boolean;
  reason: string;
  result?: RunResult;
}

/** One scheduled tick: decide, run the template's standing task, report back. */
export async function tick(now = new Date()): Promise<TickResult> {
  const template = await loadTemplate();
  const frequency =
    process.env.SETTING_FREQUENCY ?? template.config.settings.find((s) => s.key === "frequency")?.default;

  const decision = decide(frequency, now);
  if (!decision.shouldRun) return { ran: false, reason: decision.reason };

  const result = await runAgent({
    task: template.config.scheduledTask,
    trigger: "schedule",
  });

  await reportRun(result);
  return { ran: true, reason: decision.reason, result };
}
