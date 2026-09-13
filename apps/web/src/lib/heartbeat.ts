import "server-only";
import { callableCronSecret } from "./cron-auth";

export interface Worker { name: string; everyMinutes: number; does: string; }

export const WORKERS: Worker[] = [
  { name: "tasks", everyMinutes: 5, does: "runs whatever the founder scheduled" },
  { name: "briefing", everyMinutes: 5, does: "checks founder-selected briefing minutes" },
  { name: "agents", everyMinutes: 15, does: "puts the squads to work" },
  { name: "pipeline", everyMinutes: 15, does: "runs the outreach squad end to end" },
  { name: "research", everyMinutes: 30, does: "watches market changes and interrupts only on real signal" },
  { name: "diagnosis", everyMinutes: 60, does: "alerts founders only when a new health problem appears" },
  { name: "playbook", everyMinutes: 1440, does: "promotes lessons into the shared playbook" },
];

const DISPATCH_TIMEOUT_MS = 15_000;

export function selfUrl(): string | null {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;
  return null;
}

export interface DispatchResult { worker: string; outcome: "ran" | "failed"; error?: string; }

export async function dispatch(base: string, worker: Worker): Promise<DispatchResult> {
  const secret = await callableCronSecret();
  if (!secret) return { worker: worker.name, outcome: "failed", error: "No cron secret configured." };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DISPATCH_TIMEOUT_MS);
  try {
    await fetch(`${base}/api/cron/${worker.name}`, { headers: { authorization: `Bearer ${secret}` }, signal: controller.signal, cache: "no-store" });
    return { worker: worker.name, outcome: "ran" };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") return { worker: worker.name, outcome: "ran" };
    return { worker: worker.name, outcome: "failed", error: error instanceof Error ? error.message : "Unreachable." };
  } finally { clearTimeout(timer); }
}
