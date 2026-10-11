require('./load-typescript.cjs');
const {test}=require('node:test');const assert=require('node:assert/strict');
const moduleAt=require('./fixtures/module-at.cjs');
const {cronTarget}=require('../apps/web/src/lib/cron-target.ts');
const {clockHealth}=require('../apps/web/src/lib/clock-health.ts');
const {runHeartbeat}=moduleAt('apps/web/src/lib/heartbeat-run.ts');
const workers=Array.from({length:9},(_,i)=>({name:'worker'+i,everyMinutes:5,does:'test'}));
const current=new Date('2026-10-11T10:00:00Z');
const env={NEXT_PUBLIC_APP_URL:'https://production.example'};
function heartbeat(fetch,extra={}){
 return moduleAt('apps/web/src/lib/heartbeat.ts',{'./cron-auth':{callableCronSecret:async()=>'private-cron-token'},'./cron-target':{cronTarget},'./jobs/flags':{jobFlags:()=>({jobs:false,verification:false,refunds:false})}},{process:{env},fetch,setTimeout,clearTimeout,...extra});
}
function clockDb(ticks,options={}) {
 const rows=new Map(ticks.map(row=>[row.worker,{...row}]));const writes=[];
 const admin={from:()=>{let changes,filters=[];const q={};
  q.update=patch=>{changes=patch;writes.push(patch);return q;};q.eq=(key,value)=>{filters.push([key,value]);return q;};q.is=q.eq;
  q.select=()=>q;q.abortSignal=async()=>{if(options.error)return {data:null,error:{message:'test storage error'}};
   const found=[...rows.values()].filter(row=>filters.every(([key,value])=>(row[key]??null)===value));
   for(const row of found)Object.assign(row,changes);return {data:found.map(row=>({worker:row.worker})),error:null};};return q;}};
 return {admin,rows,writes};
}
test('dispatch target isolates previews and validates trusted URL configuration',()=>{
 assert.deepEqual(cronTarget(env),{origin:'https://production.example'});
 assert.deepEqual(cronTarget({...env,VERCEL_ENV:'production',VERCEL_URL:'production-kryx.vercel.app',VERCEL_AUTOMATION_BYPASS_SECRET:'private-bypass'}),{origin:'https://production.example'});
 assert.deepEqual(cronTarget({...env,VERCEL_ENV:'preview',VERCEL_URL:'preview-kryx.vercel.app',VERCEL_AUTOMATION_BYPASS_SECRET:'private-bypass'}),{origin:'https://preview-kryx.vercel.app',bypass:'private-bypass'});
 assert.equal(cronTarget({...env,VERCEL_ENV:'preview'}),null);
 for(const NEXT_PUBLIC_APP_URL of ['https://user:secret@example.com','https://example.com/path','https://example.com/?token=secret','http://example.com','file:///tmp/test'])assert.equal(cronTarget({NEXT_PUBLIC_APP_URL}),null);
 assert.deepEqual(cronTarget({NEXT_PUBLIC_APP_URL:'http://localhost:3000/'}),{origin:'http://localhost:3000'});
 assert.equal(cronTarget({...env,VERCEL_URL:'attacker.example'}),null);
});
test('timeouts are unconfirmed, never successful worker responses',async()=>{
 let timeout;
 const h=heartbeat((url,options)=>new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>{const error=new Error('timeout');error.name='AbortError';reject(error);})),{setTimeout:callback=>{timeout=callback;return 1;},clearTimeout:()=>{}});
 const pending=h.dispatch('https://production.example',workers[0]);await new Promise(resolve=>setImmediate(resolve));timeout();
 const result=await pending;assert.equal(result.outcome,'unconfirmed');assert.equal(result.code,'timeout');assert.equal(JSON.stringify(result).includes('private-cron-token'),false);
});
test('dispatch rejects redirects and HTML, scopes credentials, and distinguishes 202 acceptance',async()=>{
 let calls=0;let request;
 const h=heartbeat(async(url,options)=>{calls++;request={url,options};return Response.json({accepted:true},{status:202});},{process:{env:{...env,VERCEL_ENV:'preview',VERCEL_URL:'preview-kryx.vercel.app',VERCEL_AUTOMATION_BYPASS_SECRET:'private-bypass'}}});
 assert.equal((await h.dispatch('https://production.example',workers[0])).code,'invalid_target');assert.equal(calls,0);
 const accepted=await h.dispatch('https://preview-kryx.vercel.app',workers[0]);assert.equal(accepted.outcome,'accepted');
 assert.equal(request.options.redirect,'manual');assert.equal(request.options.headers['x-vercel-protection-bypass'],'private-bypass');assert.equal(request.options.headers.authorization,'Bearer private-cron-token');
 for(const [response,outcome,code] of [[new Response(null,{status:302,headers:{location:'https://attacker.example'}}),'failed','http_302'],[new Response('<html>login</html>',{headers:{'content-type':'text/html'}}),'failed','invalid_response'],[Response.json({ok:true}),'responded','http_200'],[Response.json({error:'private body'},{status:401}),'failed','http_401']]){
  const result=await heartbeat(async()=>response).dispatch('https://production.example',workers[0]);assert.equal(result.outcome,outcome);assert.equal(result.code,code);assert.equal(JSON.stringify(result).includes('private body'),false);
 }
});
test('network failures and missing secrets fail without exposing exception content',async()=>{
 const result=await heartbeat(async()=>{throw new Error('request private-token');}).dispatch('https://production.example',workers[0]);assert.equal(result.outcome,'failed');assert.equal(result.code,'network_error');assert.equal(JSON.stringify(result).includes('private-token'),false);
 let fetches=0;
 const h=moduleAt('apps/web/src/lib/heartbeat.ts',{'./cron-auth':{callableCronSecret:async()=>null},'./cron-target':{cronTarget},'./jobs/flags':{jobFlags:()=>({})}},{process:{env},fetch:async()=>fetches++});
 assert.equal((await h.dispatch('https://production.example',workers[0])).code,'missing_secret');assert.equal(fetches,0);
});
test('disabled verified execution is excluded from the active clock',()=>{
 const h=heartbeat(async()=>{});assert.equal(h.activeWorkers().some(worker=>worker.name==='jobs'),false);
 const enabled=moduleAt('apps/web/src/lib/heartbeat.ts',{'./cron-auth':{},'./cron-target':{cronTarget},'./jobs/flags':{jobFlags:()=>({jobs:true,verification:true,refunds:true})}});
 assert.equal(enabled.activeWorkers().some(worker=>worker.name==='jobs'),true);
});
test('nine due workers dispatch in a bounded three-lane pool and retain observations',async()=>{
 const ticks=workers.map(({name})=>({worker:name,last_run_at:null}));const {admin,rows}=clockDb(ticks);let active=0,peak=0,calls=0;
 const result=await runHeartbeat(admin,workers,ticks,false,async worker=>{calls++;active++;peak=Math.max(peak,active);await new Promise(resolve=>setTimeout(resolve,5));active--;return {worker:worker.name,outcome:'accepted',code:'http_202'};},current);
 assert.equal(calls,9);assert.equal(peak,3);assert.equal(result.dispatched.length,9);assert.equal(result.skipped.length,0);
 assert.ok([...rows.values()].every(row=>row.last_dispatch_outcome==='accepted'&&row.last_dispatch_code==='http_202'));
});
test('forced concurrent heartbeat races dispatch each worker only once',async()=>{
 const ticks=workers.map(({name})=>({worker:name,last_run_at:null}));const {admin}=clockDb(ticks);const calls=[];
 const dispatch=async worker=>{calls.push(worker.name);await new Promise(resolve=>setImmediate(resolve));return {worker:worker.name,outcome:'responded',code:'http_200'};};
 await Promise.all([runHeartbeat(admin,workers,ticks,true,dispatch,current),runHeartbeat(admin,workers,ticks,true,dispatch,current)]);
 assert.equal(calls.length,9);assert.equal(new Set(calls).size,9);
});
test('same-millisecond force updates change the claim and late observations cannot overwrite a newer claim',async()=>{
 const ticks=[{worker:workers[0].name,last_run_at:current.toISOString()}];const {admin,rows}=clockDb(ticks);
 await runHeartbeat(admin,[workers[0]],ticks,true,async worker=>{assert.notEqual(rows.get(worker.name).last_run_at,current.toISOString());Object.assign(rows.get(worker.name),{last_run_at:'2026-10-11T10:00:02Z',last_dispatch_outcome:'dispatching'});return {worker:worker.name,outcome:'responded',code:'http_200'};},current);
 assert.equal(rows.get(workers[0].name).last_dispatch_outcome,'dispatching');
});
test('storage failure, missing registration and a lost claim cannot dispatch work',async()=>{
 let calls=0;const dispatch=async()=>{calls++;};const ticks=[{worker:workers[0].name,last_run_at:null}];
 for(const [db,input,code] of [[clockDb(ticks,{error:true}),ticks,'storage_error'],[clockDb([]),[],'missing_tick']]){
  const result=await runHeartbeat(db.admin,[workers[0]],input,true,dispatch,current);assert.equal(result.dispatched[0].code,code);
 }
 const db=clockDb([{...ticks[0],last_run_at:current.toISOString()}]);const lost=await runHeartbeat(db.admin,[workers[0]],ticks,true,dispatch,current);assert.equal(lost.skipped.length,1);assert.equal(calls,0);
});
test('legacy schema remains dispatchable before additive observation columns exist',async()=>{
 const ticks=[{worker:workers[0].name,last_run_at:null}];const {admin,writes}=clockDb(ticks);
 const result=await runHeartbeat(admin,[workers[0]],ticks,false,async worker=>({worker:worker.name,outcome:'accepted',code:'http_202'}),current,false);
 assert.equal(result.dispatched[0].outcome,'accepted');assert.deepEqual(Object.keys(writes[0]),['last_run_at']);assert.equal(writes.length,1);
});
test('clock health rejects claim-only, failed, stale, invalid, future and in-flight success claims',()=>{
 const worker=workers[0];const now=current.getTime();const fresh=new Date(now-1000).toISOString();const base={worker:worker.name,last_run_at:fresh,last_dispatch_outcome:'accepted',last_dispatch_at:current.toISOString()};
 assert.equal(clockHealth([worker],[base],now).beating,true);
 for(const patch of [{last_dispatch_outcome:'failed'},{last_dispatch_outcome:'unconfirmed'},{last_dispatch_outcome:'dispatching'},{last_dispatch_outcome:null},{last_run_at:'bad'},{last_run_at:new Date(now+10000).toISOString()},{last_dispatch_at:new Date(now-2000).toISOString()},{last_run_at:new Date(now-21*60_000).toISOString()}])assert.equal(clockHealth([worker],[{...base,...patch}],now).beating,false);
 const old=clockHealth([worker],[{worker:worker.name,last_run_at:fresh}],now);assert.equal(old.beating,false);assert.equal(old.observed,'claims_only');assert.deepEqual(old.unconfirmed,[worker.name]);
});
test('cron jobs require authorization and all execution flags before scheduling background work',async()=>{
 let authorized=false,enabled=true,callbacks=[];let advanced=0;
 const route=moduleAt('apps/web/src/app/api/cron/jobs/route.ts',{'next/server':{after:fn=>callbacks.push(fn)},'@/lib/cron-auth':{authorizeCron:async()=>authorized},'@/lib/jobs/flags':{jobFlags:()=>({jobs:enabled,verification:enabled,refunds:enabled})},'@/lib/jobs/worker':{advanceJobs:async()=>advanced++}});
 const req=new Request('https://kryx.example/api/cron/jobs');assert.equal((await route.GET(req)).status,401);assert.equal(callbacks.length,0);
 authorized=true;enabled=false;assert.equal((await route.GET(req)).status,503);assert.equal(callbacks.length,0);
 enabled=true;const res=await route.GET(req);assert.equal(res.status,202);assert.equal(advanced,0);assert.deepEqual(await res.json(),{accepted:true});await callbacks[0]();assert.equal(advanced,1);
});
test('heartbeat route preserves pre-migration dispatch and reports infrastructure errors without a success response',async()=>{
 let authorized=false,mode='legacy',dispatches=0;const selects=[];
 const admin={from:()=>({select:columns=>({abortSignal:async()=>{selects.push(columns);if(mode==='offline')return {data:null,error:{code:'network'}};if(mode==='legacy'&&columns.includes('last_dispatch_outcome'))return {data:null,error:{code:'42703'}};return {data:[{worker:'jobs',last_run_at:null}],error:null};}})})};
 const route=moduleAt('apps/web/src/app/api/cron/heartbeat/route.ts',{'next/server':{NextResponse:{json:Response.json}},'@/lib/supabase/admin':{createAdminClient:()=>admin},'@/lib/cron-auth':{authorizeCron:async()=>authorized},'@/lib/heartbeat':{selfUrl:()=>'https://kryx.example',activeWorkers:()=>[workers[0]],dispatch:async()=>{}},'@/lib/heartbeat-run':{runHeartbeat:async(a,w,t,f,dispatch,now,observations)=>{dispatches++;assert.equal(observations,mode!=='legacy');return {skipped:[],dispatched:[{worker:'jobs',outcome:mode==='failed'?'failed':mode==='timeout'?'unconfirmed':'accepted',code:mode==='failed'?'http_401':mode==='timeout'?'timeout':'http_202'}]};}}});
 const req=new Request('https://kryx.example/api/cron/heartbeat');assert.equal((await route.GET(req)).status,401);assert.equal(selects.length,0);
 authorized=true;const old=await route.GET(req);assert.equal(old.status,200);const oldBody=await old.json();assert.equal(oldBody.observations,false);assert.deepEqual(oldBody.accepted,['jobs']);assert.deepEqual(selects,['worker,last_run_at,last_dispatch_outcome','worker,last_run_at']);
 mode='offline';assert.equal((await route.GET(req)).status,503);assert.equal(dispatches,1);
 mode='failed';assert.equal((await route.GET(req)).status,503);
 mode='timeout';const timed=await route.GET(req);const body=await timed.json();assert.equal(body.unconfirmed.length,1);assert.equal(body.accepted.length,0);assert.equal(body.responded.length,0);
});
test('workflow summary rejects malformed or hostile metadata and never logs response content',async()=>{
 const {heartbeatSummary}=await import('../scripts/check-heartbeat.mjs');
 const value={dispatched:['jobs'],skipped:['tasks'],failed:[],unconfirmed:[{worker:'jobs',error:'private token and customer content'}],private:'secret'};
 const summary=heartbeatSummary(value);assert.deepEqual(summary,{dispatched:['jobs'],skipped:['tasks'],failed:[],unconfirmed:['jobs']});assert.equal(JSON.stringify(summary).includes('private'),false);
 for(const invalid of [{},{...value,dispatched:['jobs\n::error::private']},{...value,failed:'not an array'}])assert.throws(()=>heartbeatSummary(invalid));
});
