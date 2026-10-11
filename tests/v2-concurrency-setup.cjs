// Emit a disposable PostgreSQL fixture. This is never used by the application.
const fs=require('node:fs');const path=require('node:path');
process.stdout.write(fs.readFileSync('tests/fixtures/v2-bootstrap.sql','utf8'));
process.stdout.write(fs.readFileSync('supabase/migrations/0031_hybrid_device_tasks.sql','utf8'));
for(const file of fs.readdirSync('supabase/migrations').filter(f=>f.includes('_kryx_v2_')).sort())process.stdout.write(fs.readFileSync(path.join('supabase/migrations',file),'utf8'));
process.stdout.write(`
create table public.v2_fixture_job(id uuid primary key);
do $$ declare contract jsonb:='{"version":"lead_list/1.0.0","taskClass":"LEAD_LIST","inputs":{"count":20},"predicates":[]}';
  founder uuid:='00000000-0000-4000-8000-000000000001'; free_job uuid; paid_job uuid; lease uuid;
begin
  free_job:=(agentstack.create_verified_job(founder,'Free fixture',contract,40,70,90,gen_random_uuid())->>'id')::uuid;
  perform agentstack.start_verified_job(free_job,founder,90);
  perform agentstack.control_verified_job(free_job,founder,'pause');
  paid_job:=(agentstack.create_verified_job(founder,'Concurrent cap fixture',contract,40,70,90,gen_random_uuid())->>'id')::uuid;
  perform agentstack.start_verified_job(paid_job,founder,90);
  lease:=(agentstack.claim_verified_job()->>'lease_token')::uuid;
  perform agentstack.begin_job_operation(paid_job,lease,'internal-budget',gen_random_uuid(),'fixture',null,90);
  perform agentstack.recover_verified_job(paid_job,lease,'credit_cap','Budget exhausted','needs_user');
  insert into public.v2_fixture_job values(paid_job);
end $$;
`);
