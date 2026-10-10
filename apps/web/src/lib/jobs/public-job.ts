import type { Job } from './types';

// An allowlist keeps future execution fields out of every founder-facing response.
const fields = ['id','instruction','task_class','status','completion_contract','estimated_credits','estimate_min',
  'hard_cap','credits_used','reserved_credits','is_free','created_at','started_at','finished_at','summary',
  'receipt','next_run_at','blocker_category'] as const satisfies readonly (keyof Job)[];
export const PUBLIC_JOB_COLUMNS=fields.join(',');
export function publicJob(record:Record<string,unknown>):Job {
  return Object.fromEntries(fields.map(field=>[field,record[field]])) as unknown as Job;
}
