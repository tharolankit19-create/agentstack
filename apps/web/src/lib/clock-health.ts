import type { Worker } from './heartbeat';
import type { Tick } from './heartbeat-run';
export interface ObservedTick extends Tick {
  last_dispatch_outcome?: string | null;
  last_dispatch_at?: string | null;
}

/** Claim timestamps alone cannot prove a worker accepted its invocation. */
export function clockHealth(workers: Worker[], ticks: ObservedTick[], now=Date.now()) {
  const byWorker=new Map(ticks.map(tick=>[tick.worker,tick]));
  const observations=ticks.some(tick=>'last_dispatch_outcome' in tick);
  const stamps=workers.map(worker=>Date.parse(byWorker.get(worker.name)?.last_run_at??'')).filter(stamp=>Number.isFinite(stamp)&&stamp<=now);
  const stalled=workers.filter(worker=>{
    const tick=byWorker.get(worker.name);
    const stamp=Date.parse(tick?.last_run_at??'');
    if(!Number.isFinite(stamp)||stamp>now||now-stamp>Math.max(10,worker.everyMinutes*4)*60_000)return true;
    if(!observations)return false;
    const response=Date.parse(tick?.last_dispatch_at??'');
    return !['accepted','responded'].includes(tick?.last_dispatch_outcome??'')||!Number.isFinite(response)||response<stamp||response>now;
  }).map(worker=>worker.name);
  const unconfirmed=workers.filter(worker=>{
    const tick=byWorker.get(worker.name);
    return !observations||!tick?.last_dispatch_outcome||['dispatching','unconfirmed'].includes(tick.last_dispatch_outcome);
  }).map(worker=>worker.name);
  return {
    beating:stalled.length===0&&observations,never:stamps.length===0,
    lastBeatAt:stamps.length?new Date(Math.max(...stamps)).toISOString():null,
    stalled,unconfirmed,observed:observations?'worker_responses' as const:'claims_only' as const,
    ...(stalled.length?{note:'Scheduled worker dispatch is behind or unconfirmed. Check heartbeat responses and deployment access.'}:!observations?{note:'Only scheduling claims are available. Apply the dispatch-receipt migration to observe worker responses.'}:{}),
  };
}
