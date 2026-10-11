import "server-only";
import { callableCronSecret } from "./cron-auth";
import { jobFlags } from "./jobs/flags";
import { cronTarget } from "./cron-target";

export interface Worker { name: string; everyMinutes: number; does: string; }

export const WORKERS: Worker[] = [
  { name: "jobs", everyMinutes: 1, does: "advances verified jobs from safe checkpoints" },
  { name: "hybrid", everyMinutes: 5, does: "advances hybrid cloud/device marketing missions" },
  { name: "tasks", everyMinutes: 5, does: "runs whatever the founder scheduled" },
  { name: "briefing", everyMinutes: 5, does: "checks founder-selected briefing minutes" },
  { name: "agents", everyMinutes: 15, does: "puts the squads to work" },
  { name: "pipeline", everyMinutes: 15, does: "runs the outreach squad end to end" },
  { name: "research", everyMinutes: 30, does: "watches market changes and interrupts only on real signal" },
  { name: "diagnosis", everyMinutes: 60, does: "alerts founders only when a new health problem appears" },
  { name: "playbook", everyMinutes: 1440, does: "promotes lessons into the shared playbook" },
];

const DISPATCH_TIMEOUT_MS = 12_000;

export function selfUrl(): string | null {
  return cronTarget(process.env)?.origin ?? null;
}

export function activeWorkers(): Worker[] {
  const flags = jobFlags();
  return WORKERS.filter(worker => worker.name !== 'jobs' || (flags.jobs && flags.verification && flags.refunds));
}

export type DispatchOutcome = 'accepted' | 'responded' | 'unconfirmed' | 'failed';
export interface DispatchResult { worker: string; outcome: DispatchOutcome; code?: string; error?: string; }

export async function dispatch(base: string, worker: Worker): Promise<DispatchResult> {
  const target = cronTarget(process.env);
  // Never forward either credential to a caller-provided or redirected origin.
  if (!target || base !== target.origin) return { worker: worker.name, outcome: 'failed', code: 'invalid_target', error: 'No valid deployment target configured.' };
  const secret = await callableCronSecret();
  if (!secret) return { worker: worker.name, outcome: "failed", code: 'missing_secret', error: "No cron secret configured." };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DISPATCH_TIMEOUT_MS);
  try {
    const headers: Record<string,string> = { authorization: `Bearer ${secret}` };
    if (target.bypass) headers['x-vercel-protection-bypass'] = target.bypass;
    const response = await fetch(`${base}/api/cron/${worker.name}`, { headers, signal: controller.signal, cache: "no-store", redirect: 'manual' });
    if (!response.ok) return { worker: worker.name, outcome: "failed", code: `http_${response.status}`, error: `HTTP ${response.status}` };
    if (!response.headers.get('content-type')?.includes('application/json')) return {worker:worker.name,outcome:'failed',code:'invalid_response',error:'The worker did not return an application JSON response.'};
    return { worker: worker.name, outcome: response.status === 202 ? 'accepted' : 'responded', code: `http_${response.status}` };
  } catch (error) {
    if (controller.signal.aborted || (error instanceof Error && error.name === "AbortError")) return { worker: worker.name, outcome: 'unconfirmed', code: 'timeout', error: 'No response before the dispatch deadline; execution is unconfirmed.' };
    return { worker: worker.name, outcome: "failed", code: 'network_error', error: 'The worker could not be reached.' };
  } finally { clearTimeout(timer); }
}
