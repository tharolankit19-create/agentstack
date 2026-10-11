require('./load-typescript.cjs');
const {test}=require('node:test');const assert=require('node:assert/strict');const crypto=require('node:crypto');
const moduleAt=require('./fixtures/module-at.cjs');const engine=require('../apps/web/src/lib/job-engine.ts');
const JOB=crypto.randomUUID(),OWNER=crypto.randomUUID(),DEVICE=crypto.randomUUID();
function adminFor(records){const calls=[];const admin={from:table=>{calls.push({table,method:'from'});const q={};for(const method of ['select','eq','limit','update'])q[method]=(...args)=>{calls.push({table,method,args});return q;};q.maybeSingle=()=>Promise.resolve({data:records[table]??null,error:null});q.then=(resolve,reject)=>Promise.resolve({data:records[table]??[],error:null}).then(resolve,reject);return q;}};return {admin,calls};}
const auth={'@/lib/auth':{requireApiUser:async()=>({ok:true,session:{userId:OWNER}})},'@/lib/desktop-auth':{verifyDeviceRequest:async()=>({ok:true,device:{userId:OWNER,id:DEVICE}})},'next/server':{NextResponse:{json:Response.json}},'@/lib/job-engine':engine};
test('legacy resume and device advance cannot mutate or dispatch a verified job',async()=>{
 for(const [path,device] of [['apps/web/src/app/api/missions/hybrid/[id]/resume/route.ts',false],['apps/web/src/app/api/device/missions/[id]/advance/route.ts',true]]){
  const {admin,calls}=adminFor({hybrid_missions:{id:JOB,planner:{engine:'verified_jobs_v2'},status:'waiting_for_user'}});let advances=0;
  const route=moduleAt(path,{...auth,'@/lib/supabase/admin':{createAdminClient:()=>admin},'@/lib/hybrid-missions':{advanceHybridMissions:async()=>{advances++;return {advanced:1};}}});
  const response=await route.POST(new Request('https://kryx.example/resume',{method:'POST'}),{params:Promise.resolve({id:JOB})});assert.equal(response.status,409);assert.equal(advances,0);assert.equal(calls.filter(c=>c.method==='update').length,0);
  assert.equal(calls.filter(c=>c.method==='from').length,1);assert.equal((await response.json()).jobUrl,`/dashboard/jobs?id=${JOB}`);assert.ok(calls.some(c=>c.method==='eq'&&c.args[0]==='user_id'&&c.args[1]===OWNER));
  if(device)assert.ok(calls.find(c=>c.method==='select').args[0].includes('planner'));
 }
});
test('legacy approvals stop before any write when the parent is a V2 job',async()=>{
 const approval=crypto.randomUUID();const {admin,calls}=adminFor({action_approvals:{id:approval,mission_id:JOB,task_id:null},hybrid_missions:{id:JOB,planner:{engine:'verified_jobs_v2'}}});
 const route=moduleAt('apps/web/src/app/api/action-approvals/[id]/decision/route.ts',{...auth,'@/lib/supabase/admin':{createAdminClient:()=>admin}});
 for(const decision of ['approve','reject']){const response=await route.POST(new Request('https://kryx.example/decision',{method:'POST',body:JSON.stringify({decision})}),{params:Promise.resolve({id:approval})});assert.equal(response.status,409);}
 assert.equal(calls.filter(c=>c.method==='update').length,0);
});
test('old mission advancement and approval still work with the pre-V2 planner shape',async()=>{
 const {admin,calls}=adminFor({hybrid_missions:{id:JOB,planner:{steps:[]},selected_device_id:DEVICE},action_approvals:{id:crypto.randomUUID(),mission_id:JOB,task_id:null}});let advances=0;
 const advance=moduleAt('apps/web/src/app/api/device/missions/[id]/advance/route.ts',{...auth,'@/lib/supabase/admin':{createAdminClient:()=>admin},'@/lib/hybrid-missions':{advanceHybridMissions:async()=>{advances++;return {advanced:1};}}});
 assert.equal((await advance.POST(new Request('https://kryx.example/advance',{method:'POST'}),{params:Promise.resolve({id:JOB})})).status,200);assert.equal(advances,1);
 const approval=moduleAt('apps/web/src/app/api/action-approvals/[id]/decision/route.ts',{...auth,'@/lib/supabase/admin':{createAdminClient:()=>admin}});
 assert.equal((await approval.POST(new Request('https://kryx.example/decision',{method:'POST',body:'{"decision":"approve"}'}),{params:Promise.resolve({id:crypto.randomUUID()})})).status,200);assert.equal(calls.filter(c=>c.method==='update').length,1);
});
