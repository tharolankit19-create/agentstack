begin;
-- Result, verdict, and artifacts are persisted atomically under a current worker lease.
-- A paused/replaced worker cannot overwrite the deliverable after losing ownership.
create or replace function agentstack.store_verified_job_result(p_job uuid,p_token uuid,p_worker uuid,p_verdict jsonb,p_artifacts jsonb)
returns uuid language plpgsql security invoker set search_path=agentstack,pg_temp as $$
declare j agentstack.hybrid_missions; verification_id uuid; artifact jsonb; passed boolean;
begin
 select * into j from agentstack.hybrid_missions where id=p_job and task_class is not null and lease_token=p_token and lease_expires_at>now() and status in ('running','verifying') for update;
 if j.id is null then raise exception 'worker lease lost'; end if;
 if p_worker=(p_verdict->>'verifierRunId')::uuid or p_worker is null or p_verdict->>'verifierRunId' is null then raise exception 'independent verifier required'; end if;
 if p_verdict->>'contractVersion' is distinct from j.completion_contract->>'version' or p_verdict->>'outputHash' !~ '^[0-9a-f]{64}$' then raise exception 'invalid verification binding'; end if;
 if jsonb_typeof(p_verdict->'passed') is distinct from 'boolean' or jsonb_typeof(p_verdict->'checks') is distinct from 'array' then raise exception 'invalid verifier result'; end if;
 passed:=(p_verdict->>'passed')::boolean;
 if passed and (jsonb_array_length(p_verdict->'checks')=0 or exists(select 1 from jsonb_array_elements(p_verdict->'checks') c where c->>'passed' is distinct from 'true')
   or exists(select 1 from jsonb_array_elements(j.completion_contract->'predicates') p where not exists(select 1 from jsonb_array_elements(p_verdict->'checks') c where c->>'id'=p->>'id' and c->>'passed'='true'))) then raise exception 'all completion checks required'; end if;
 if jsonb_typeof(p_artifacts) is distinct from 'array' or passed and jsonb_array_length(p_artifacts)=0 then raise exception 'verified artifact required'; end if;
 for artifact in select * from jsonb_array_elements(p_artifacts) loop
  if length(coalesce(artifact->>'content',''))=0 or artifact->>'sha256' is distinct from encode(sha256(convert_to(artifact->>'content','UTF8')),'hex') then raise exception 'artifact digest mismatch'; end if;
  insert into agentstack.job_artifacts(job_id,user_id,name,media_type,content,sha256)
  values(j.id,j.user_id,artifact->>'name',artifact->>'media_type',artifact->>'content',artifact->>'sha256')
  on conflict(job_id,name) do update set content=excluded.content,sha256=excluded.sha256,media_type=excluded.media_type,created_at=now();
 end loop;
 insert into agentstack.job_verifications(job_id,user_id,worker_run_id,verifier_run_id,contract_version,output_hash,passed,result,verifier)
 values(j.id,j.user_id,p_worker,(p_verdict->>'verifierRunId')::uuid,p_verdict->>'contractVersion',p_verdict->>'outputHash',passed,p_verdict,'independent_source_reads_and_separate_model_pass') returning id into verification_id;
 update agentstack.hybrid_missions set output_hash=p_verdict->>'outputHash' where id=j.id;
 return verification_id;
end $$;
revoke all on function agentstack.store_verified_job_result(uuid,uuid,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function agentstack.store_verified_job_result(uuid,uuid,uuid,jsonb,jsonb) to service_role;
commit;
notify pgrst,'reload schema';
