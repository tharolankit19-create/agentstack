import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { authorizeCron } from '@/lib/cron-auth';
import { activeWorkers, dispatch, selfUrl } from '@/lib/heartbeat';
import { runHeartbeat, type Tick } from '@/lib/heartbeat-run';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/** Claim turns atomically before dispatch; a response acknowledges no job outcome. */
export async function GET(request: Request) {
  if (!(await authorizeCron(request))) return NextResponse.json({error:'Unauthorized.'},{status:401});
  const base = selfUrl();
  if (!base) return NextResponse.json({error:'Configure a valid deployment URL so the heartbeat can reach its own workers.'},{status:503});
  const admin = createAdminClient();
  try {
    let ticks: {data:Tick[]|null;error:{code:string}|null} = await admin.from('cron_ticks').select('worker,last_run_at,last_dispatch_outcome').abortSignal(AbortSignal.timeout(2000));
    const observations = !ticks.error;
    // Preserve the legacy scheduler when code arrives before additive DDL.
    if (ticks.error && ['42703','PGRST204'].includes(ticks.error.code)) ticks = await admin.from('cron_ticks').select('worker,last_run_at').abortSignal(AbortSignal.timeout(2000));
    if (ticks.error || !ticks.data) return NextResponse.json({error:'Worker scheduling storage is unavailable.'},{status:503});
    const {dispatched,skipped} = await runHeartbeat(admin,activeWorkers(),ticks.data,new URL(request.url).searchParams.get('force')==='1',worker=>dispatch(base,worker),new Date(),observations);
    const failed = dispatched.filter(result=>result.outcome==='failed');
    const unconfirmed = dispatched.filter(result=>result.outcome==='unconfirmed');
    if (failed.length || unconfirmed.length) console.error('[cron/heartbeat] dispatch issues:',[...failed,...unconfirmed].map(({worker,code})=>({worker,code})));
    return NextResponse.json({
      at:new Date().toISOString(),dispatched:dispatched.map(result=>result.worker),skipped,observations,
      accepted:dispatched.filter(result=>result.outcome==='accepted').map(result=>result.worker),
      responded:dispatched.filter(result=>result.outcome==='responded').map(result=>result.worker),
      unconfirmed:unconfirmed.map(({worker,code,error})=>({worker,code,error})),
      failed:failed.map(({worker,code,error})=>({worker,code,error})),
    },{status:failed.length?503:200,headers:{'Cache-Control':'private,no-store'}});
  } catch {
    console.error('[cron/heartbeat] dispatch storage or infrastructure failed');
    return NextResponse.json({error:'Heartbeat dispatch could not be completed safely.'},{status:503});
  }
}
