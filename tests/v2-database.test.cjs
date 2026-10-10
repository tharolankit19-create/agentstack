const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PGlite } = require('@electric-sql/pglite');
const fs = require('node:fs');
const path = require('node:path');
const USER='00000000-0000-4000-8000-000000000001';
const OTHER='00000000-0000-4000-8000-000000000002';
async function database() {
 const db=new PGlite();
 try {
 await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
 create schema auth; create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema auth to authenticated,service_role;
 create schema agentstack; grant usage on schema agentstack to authenticated,service_role;
 create table agentstack.profiles(id uuid primary key references auth.users,credit_balance integer not null default 500,credits_spent integer not null default 0);
 create table agentstack.cron_ticks(worker text primary key,last_run_at timestamptz); create table agentstack.agents(id uuid primary key); create table agentstack.devices(id uuid primary key);
 grant all on all tables in schema agentstack to service_role;
 insert into auth.users values('${USER}'),('${OTHER}'); insert into agentstack.profiles(id) values('${USER}'),('${OTHER}');`);
 await db.exec(fs.readFileSync('supabase/migrations/0031_hybrid_device_tasks.sql','utf8'));
 for(const f of fs.readdirSync('supabase/migrations').filter(f=>f.includes('_kryx_v2_')).sort()) await db.exec(fs.readFileSync(path.join('supabase/migrations',f),'utf8'));
 return db;
 } catch(error) { await db.close(); throw error; }
}
async function create(db,user=USER,key=crypto.randomUUID()) {
 const contract={version:'lead_list/1.0.0',taskClass:'LEAD_LIST',inputs:{count:20},predicates:[]};
 return (await db.query(`select agentstack.create_verified_job($1,'Find 20 founders',$2,40,70,90,$3) as job`,[user,JSON.stringify(contract),key])).rows[0].job;
}
test('additive migration, ownership, service-only creation, idempotency and completion guard',async()=>{
 const db=await database();
 try{
  const key=crypto.randomUUID();const a=await create(db,USER,key);assert.equal((await create(db,USER,key)).id,a.id);
  await create(db,OTHER);
  await db.exec(`set role authenticated; set request.jwt.claim.sub='${USER}';`);
  assert.equal((await db.query('select * from agentstack.hybrid_missions')).rows.length,1);
  await assert.rejects(()=>db.query('update agentstack.hybrid_missions set status=\'completed\''));
  await assert.rejects(()=>create(db,USER));
  await db.exec('reset role');
  await assert.rejects(()=>db.query(`update agentstack.hybrid_missions set status='completed' where id=$1`,[a.id]),/passing independent verification/);
  const balances=(await db.query('select credit_balance from agentstack.profiles')).rows;assert.ok(balances.every(b=>b.credit_balance===500));
 }finally{await db.close();}
});
test('lease excludes duplicate workers and stale worker cannot checkpoint after takeover',async()=>{
 const db=await database();
 try{
  const a=await create(db);await db.query("update agentstack.hybrid_missions set status='queued' where id=$1",[a.id]);
  const first=(await db.query('select agentstack.claim_verified_job() as job')).rows[0].job;
  assert.ok(first.lease_token);assert.equal((await db.query('select agentstack.claim_verified_job() as job')).rows[0].job,null);
  await db.query("update agentstack.hybrid_missions set lease_expires_at=now()-interval '1 second' where id=$1",[a.id]);
  const second=(await db.query('select agentstack.claim_verified_job() as job')).rows[0].job;
  assert.notEqual(second.lease_token,first.lease_token);
  assert.equal((await db.query("select agentstack.checkpoint_verified_job($1,$2,'discover','{}','Saved') as ok",[a.id,first.lease_token])).rows[0].ok,false);
  assert.equal((await db.query("select agentstack.checkpoint_verified_job($1,$2,'discover','{}','Saved') as ok",[a.id,second.lease_token])).rows[0].ok,true);
 }finally{await db.close();}
});
module.exports={database,create,USER,OTHER};
test('in-flight checkpoints retain the lease, reject stale workers, and clear independent reads on verifier rewind',async()=>{
 const db=await database();try{
  const job=await create(db);await db.query("update agentstack.hybrid_missions set status='queued',attempt=1 where id=$1",[job.id]);const c=await claim(db);
  const state={stage:'verify',workerRunId:crypto.randomUUID(),verifierRunId:crypto.randomUUID(),billableKeys:['source','old-extraction'],discoveryKeys:['source'],verificationSources:[{url:'https://example.com'}],verificationCursor:1};
  const save=(token)=>db.query("select agentstack.save_verified_job_progress($1,$2,$3,'Source batch saved') as ok",[job.id,token,JSON.stringify(state)]);
  assert.equal((await save(c.lease_token)).rows[0].ok,true);assert.equal(await claim(db),null);
  assert.equal((await save(crypto.randomUUID())).rows[0].ok,false);
  await db.query("select agentstack.recover_verified_job($1,$2,'verification_failed','Rejected evidence','retry')",[job.id,c.lease_token]);
  const checkpoint=(await db.query("select state from agentstack.job_checkpoints where job_id=$1 and step='pipeline'",[job.id])).rows[0].state;
  assert.equal(checkpoint.stage,'extract');assert.deepEqual(checkpoint.billableKeys,['source']);
  assert.equal(checkpoint.verificationSources,undefined);assert.equal(checkpoint.verificationCursor,undefined);assert.equal(checkpoint.verifierRunId,undefined);
  assert.equal((await save(c.lease_token)).rows[0].ok,false);
  await db.exec(`set role authenticated; set request.jwt.claim.sub='${USER}';`);await assert.rejects(()=>save(c.lease_token));
 }finally{await db.close();}
});
test('a fully unavailable discovery pass resets its source cursor for an actual bounded retry',async()=>{
 const db=await database();try{
  const job=await create(db);await db.query("update agentstack.hybrid_missions set status='queued',attempt=1 where id=$1",[job.id]);const c=await claim(db);
  const state={stage:'discover',workerRunId:crypto.randomUUID(),billableKeys:['abandoned-search'],sources:[],discoveryUrls:['https://example.com'],discoveryCursor:1};
  await db.query("select agentstack.save_verified_job_progress($1,$2,$3,'No usable sources')",[job.id,c.lease_token,JSON.stringify(state)]);
  await db.query("select agentstack.recover_verified_job($1,$2,'source_unavailable','Network unavailable','retry')",[job.id,c.lease_token]);
  const checkpoint=(await db.query('select state from agentstack.job_checkpoints where job_id=$1',[job.id])).rows[0].state;
  assert.equal(checkpoint.discoveryUrls,undefined);assert.equal(checkpoint.discoveryCursor,undefined);assert.deepEqual(checkpoint.billableKeys,[]);
 }finally{await db.close();}
});
async function start(db,j,cap=90){return (await db.query('select agentstack.start_verified_job($1,$2,$3) as job',[j.id,j.user_id,cap])).rows[0].job;}
async function claim(db){return (await db.query('select agentstack.claim_verified_job() as job')).rows[0].job;}
async function passing(db,j){const worker=crypto.randomUUID(),verifier=crypto.randomUUID();await db.query(`insert into agentstack.job_verifications(job_id,user_id,worker_run_id,verifier_run_id,contract_version,output_hash,passed,result,verifier) values($1,$2,$3,$4,'lead_list/1.0.0','output-hash',true,'{}','test independent verifier')`,[j.id,j.user_id,worker,verifier]);await db.query(`insert into agentstack.job_artifacts(job_id,user_id,name,media_type,content,sha256) values($1,$2,'leads.csv','text/csv','test csv','csv-hash')`,[j.id,j.user_id]);}
test('one successful free job, verified settlement, retries not charged, cancellation release is idempotent',async()=>{
 const db=await database();try{
  const free=await start(db,await create(db));assert.equal(free.is_free,true);const c=await claim(db);await passing(db,c);
  await db.query(`select agentstack.complete_verified_job($1,$2,'output-hash','{}','{"result":"20/20 verified"}')`,[c.id,c.lease_token]);
  assert.equal((await db.query('select credit_balance from agentstack.profiles where id=$1',[USER])).rows[0].credit_balance,500);
  const paid=await start(db,await create(db));assert.equal(paid.is_free,false);
  assert.equal((await db.query('select credit_balance from agentstack.profiles where id=$1',[USER])).rows[0].credit_balance,410);
  const p=await claim(db);const run=crypto.randomUUID();
  const begin=async(key,credits)=>(await db.query(`select agentstack.begin_job_operation($1,$2,$3,$4,'model','test',$5) as id`,[p.id,p.lease_token,key,run,credits])).rows[0].id;
  const finish=async(id,ok)=>db.query('select agentstack.finish_job_operation($1,$2,$3,$4,12,10,20,null,null)',[p.id,p.lease_token,id,ok]);
  await finish(await begin('failed-attempt',7),false);await finish(await begin('abandoned-success',5),true);await finish(await begin('verified-output',23),true);
  await passing(db,p);
  const receipt=(await db.query(`select agentstack.complete_verified_job($1,$2,'output-hash',array['verified-output'],'{"result":"20/20 verified","creditsUsed":999}') as receipt`,[p.id,p.lease_token])).rows[0].receipt;
  assert.equal(receipt.creditsUsed,23);assert.equal(receipt.failedAttemptsCharged,0);assert.equal(receipt.releasedCredits,67);
  assert.equal((await db.query('select credit_balance from agentstack.profiles where id=$1',[USER])).rows[0].credit_balance,477);
  await assert.rejects(()=>db.query(`select agentstack.complete_verified_job($1,$2,'output-hash','{}','{}')`,[p.id,p.lease_token]));
  const cancel=await start(db,await create(db));await db.query("select agentstack.control_verified_job($1,$2,'cancel')",[cancel.id,USER]);await db.query("select agentstack.control_verified_job($1,$2,'cancel')",[cancel.id,USER]);
  assert.equal((await db.query('select credit_balance from agentstack.profiles where id=$1',[USER])).rows[0].credit_balance,477);
 }finally{await db.close();}
});
test('hard cap applies to internal failed compute and forced failure returns whole reservation',async()=>{
 const db=await database();try{
  const first=await start(db,await create(db));await db.query("select agentstack.control_verified_job($1,$2,'pause')",[first.id,USER]);
  const paid=await start(db,await create(db));assert.equal(paid.is_free,false);const p=await claim(db);assert.equal(p.id,paid.id);
  await db.query(`select agentstack.begin_job_operation($1,$2,'full', $3,'model','test',90)`,[p.id,p.lease_token,crypto.randomUUID()]);
  await assert.rejects(()=>db.query(`select agentstack.begin_job_operation($1,$2,'over',$3,'model','test',1)`,[p.id,p.lease_token,crypto.randomUUID()]),/credit_cap/);
  await db.query(`select agentstack.recover_verified_job($1,$2,'verification_failed','Failed proof','fail')`,[p.id,p.lease_token]);
  assert.equal((await db.query('select credit_balance from agentstack.profiles where id=$1',[USER])).rows[0].credit_balance,500);
  const row=(await db.query('select status,credits_used,reserved_credits from agentstack.hybrid_missions where id=$1',[p.id])).rows[0];assert.equal(row.status,'refunded');assert.equal(row.credits_used,0);assert.equal(row.reserved_credits,0);
 }finally{await db.close();}
});
test('pause fences running worker; cross-owner actions fail; pending usage cannot be billed',async()=>{
 const db=await database();try{
  const first=await start(db,await create(db));const p=await claim(db);
  assert.equal((await db.query("select agentstack.control_verified_job($1,$2,'cancel') as ok",[first.id,OTHER])).rows[0].ok,false);
  const usage=(await db.query(`select agentstack.begin_job_operation($1,$2,'pending',$3,'model','test',5) as id`,[p.id,p.lease_token,crypto.randomUUID()])).rows[0].id;
  await passing(db,p);await assert.rejects(()=>db.query(`select agentstack.complete_verified_job($1,$2,'output-hash',array['pending'],'{"result":"Done"}')`,[p.id,p.lease_token]),/unsuccessful/);
  await db.query("select agentstack.control_verified_job($1,$2,'pause')",[first.id,USER]);
  assert.equal((await db.query('select agentstack.finish_job_operation($1,$2,$3,true,12,null,null,null,null) as ok',[p.id,p.lease_token,usage])).rows[0].ok,false);
  await db.query("select agentstack.control_verified_job($1,$2,'resume')",[first.id,USER]);const next=await claim(db);assert.notEqual(next.lease_token,p.lease_token);
 }finally{await db.close();}
});
test('result persistence is fenced, checks must pass, and artifact bytes are bound to digest',async()=>{
 const db=await database();try{
  const p=await claim(db).catch(()=>null);assert.equal(p,null);
  const job=await start(db,await create(db));const c=await claim(db);
  const worker=crypto.randomUUID(),verifier=crypto.randomUUID(),hash=require('node:crypto').createHash('sha256').update('result').digest('hex');
  const content='name,company\nTest,Fixture\n';const artifact={name:'leads.csv',media_type:'text/csv',content,sha256:require('node:crypto').createHash('sha256').update(content).digest('hex')};
  const verdict={passed:true,checks:[{id:'schema',passed:true}],verifierRunId:verifier,contractVersion:'lead_list/1.0.0',outputHash:hash};
  const store=(token,v=verdict,a=[artifact])=>db.query('select agentstack.store_verified_job_result($1,$2,$3,$4,$5)',[job.id,token,worker,JSON.stringify(v),JSON.stringify(a)]);
  await assert.rejects(()=>store(crypto.randomUUID()),/lease lost/);
  await assert.rejects(()=>store(c.lease_token,{...verdict,checks:[{id:'schema',passed:false}]}),/all completion checks/);
  await assert.rejects(()=>store(c.lease_token,verdict,[{...artifact,content:content+'tamper'}]),/digest mismatch/);
  await assert.rejects(()=>store(c.lease_token,{...verdict,verifierRunId:worker}),/independent/);
  await store(c.lease_token);
  await db.query("select agentstack.control_verified_job($1,$2,'pause')",[job.id,USER]);
  await assert.rejects(()=>store(c.lease_token),/lease lost/);
  assert.equal((await db.query('select count(*)::int as n from agentstack.job_verifications where job_id=$1',[job.id])).rows[0].n,1);
 }finally{await db.close();}
});
test('reapplying additive V2 migrations preserves existing jobs, wallet, and messages',async()=>{
 const db=await database();try{
  const job=await create(db);
  await db.query("insert into agentstack.hybrid_missions(user_id,instruction,status) values($1,'Readable legacy mission','completed')",[USER]);
  for(const f of fs.readdirSync('supabase/migrations').filter(f=>f.includes('_kryx_v2_')).sort())await db.exec(fs.readFileSync(path.join('supabase/migrations',f),'utf8'));
  assert.equal((await db.query('select count(*)::int as n from agentstack.hybrid_missions')).rows[0].n,2);
  assert.equal((await db.query('select count(*)::int as n from agentstack.job_messages where job_id=$1',[job.id])).rows[0].n,1);
  assert.equal((await db.query('select count(*)::int as n from agentstack.hybrid_mission_steps where mission_id=$1',[job.id])).rows[0].n,4);
  assert.equal((await db.query('select credit_balance from agentstack.profiles where id=$1',[USER])).rows[0].credit_balance,500);
 }finally{await db.close();}
});
