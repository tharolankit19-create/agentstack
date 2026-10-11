import 'server-only';
import type { Admin } from './jobs/store';
import type { Worker, DispatchResult } from './heartbeat';

export interface Tick { worker: string; last_run_at: string | null; }
type Dispatch = (worker: Worker) => Promise<DispatchResult>;

/** Three lanes, 12s dispatches and 2s storage waits fit nine workers into 60s. */
export async function runHeartbeat(admin: Admin, workers: Worker[], ticks: Tick[], force: boolean, dispatch: Dispatch, now = new Date(), observations = true) {
  const byWorker = new Map(ticks.map(tick => [tick.worker, tick.last_run_at]));
  const dispatched: DispatchResult[] = [];
  const skipped: string[] = [];
  let cursor = 0;
  async function lane() {
    while (cursor < workers.length) {
      const worker = workers[cursor++];
      if (!byWorker.has(worker.name)) {
        dispatched.push({worker:worker.name,outcome:'failed',code:'missing_tick',error:'Worker registration is missing; apply the required migration.'});
        continue;
      }
      const lastRun = byWorker.get(worker.name) ?? null;
      const stamp = lastRun ? Date.parse(lastRun) : NaN;
      if (!force && Number.isFinite(stamp) && now.getTime() - stamp < worker.everyMinutes * 60_000) { skipped.push(worker.name); continue; }
      // Always change a claim, including two forced calls in the same millisecond.
      const at = new Date(Math.max(now.getTime(),Number.isFinite(stamp)&&stamp<=now.getTime()?stamp+1:0)).toISOString();
      let query = admin.from('cron_ticks').update({last_run_at:at,...(observations?{last_dispatch_outcome:'dispatching',last_dispatch_at:null,last_dispatch_code:null}:{})}).eq('worker',worker.name);
      query = lastRun ? query.eq('last_run_at',lastRun) : query.is('last_run_at',null);
      const claim = await query.select('worker').abortSignal(AbortSignal.timeout(2000));
      if (claim.error) { dispatched.push({worker:worker.name,outcome:'failed',code:'storage_error',error:'The worker turn could not be claimed.'}); continue; }
      // Even manual force must win the conditional claim. Never duplicate a race loser.
      if (!claim.data?.length) { skipped.push(worker.name); continue; }
      let result:DispatchResult;
      try { result = await dispatch(worker); }
      catch { result = {worker:worker.name,outcome:'failed',code:'network_error',error:'Worker dispatch infrastructure failed.'}; }
      if (!observations) { dispatched.push(result); continue; }
      // A late response must not overwrite a newer heartbeat's observation.
      const recorded = await admin.from('cron_ticks').update({last_dispatch_outcome:result.outcome,last_dispatch_at:new Date().toISOString(),last_dispatch_code:result.code??null}).eq('worker',worker.name).eq('last_run_at',at).eq('last_dispatch_outcome','dispatching').select('worker').abortSignal(AbortSignal.timeout(2000));
      dispatched.push(recorded.error ? {worker:worker.name,outcome:'failed',code:'storage_error',error:'The worker response could not be recorded.'} : result);
    }
  }
  await Promise.all(Array.from({length:Math.min(3,workers.length)},lane));
  return {dispatched,skipped};
}
