import "server-only";
import { randomUUID } from "node:crypto";
import { checked, type Admin } from "./store";
import type { Job } from "./types";
import { JobFailure, failureOf } from "./recovery";
export interface OperationResult<T> { value:T; key:string; }
export async function operation<T>(admin:Admin,job:Job,runId:string,service:string,credits:number,fn:()=>Promise<T>,model:string|null=null):Promise<OperationResult<T>> {
  const key=`${runId}:${service}:${randomUUID()}`;
  const reserve=await admin.rpc('begin_job_operation',{p_job:job.id,p_token:job.lease_token,p_key:key,p_run:runId,p_service:service,p_model:model,p_credits:credits});
  if(reserve.error) throw new JobFailure(reserve.error.message.includes('credit_cap')?'credit_cap':'tool_failed',reserve.error.message.includes('credit_cap')?'The job reached its hard credit cap.':'Worker lease or budget could not be reserved.');
  const start=Date.now();
  try {
    const value=await fn();
    const finish=checked(await admin.rpc('finish_job_operation',{p_job:job.id,p_token:job.lease_token,p_operation:reserve.data,p_ok:true,p_latency:Date.now()-start,p_input:null,p_output:null,p_cost:null,p_error:null}));
    if(!finish) throw new JobFailure('tool_failed','Worker lease was revoked before the result could be persisted.');
    return {value,key};
  } catch(cause) {
    const f=failureOf(cause);
    checked(await admin.rpc('finish_job_operation',{p_job:job.id,p_token:job.lease_token,p_operation:reserve.data,p_ok:false,p_latency:Date.now()-start,p_input:null,p_output:null,p_cost:null,p_error:f.category}));
    throw f;
  }
}
