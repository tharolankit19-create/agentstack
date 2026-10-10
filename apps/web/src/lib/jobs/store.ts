import "server-only";
import { createAdminClient } from "../supabase/admin";
import type { Job, JobDetail, JobView } from "./types";
import { usageSummary } from './usage';
import {verificationIsFresh} from './verification';
export type Admin = ReturnType<typeof createAdminClient>;
export function checked<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}
export async function ownedJob(admin: Admin, userId: string, id: string): Promise<Job | null> {
  return checked(await admin.from("hybrid_missions").select("*").eq("id", id).eq("user_id", userId).not("task_class", "is", null).maybeSingle<Job>());
}
export async function listJobs(admin: Admin, userId: string, view?: JobView) {
  let query = admin.from("hybrid_missions").select("*").eq("user_id", userId).not("task_class", "is", null).order("created_at", { ascending: false }).limit(100);
  if (view === "working") query = query.in("status", ["queued", "planning", "running", "recovering", "verifying", "waiting_for_browser", "waiting_for_device"]);
  if (view === "needs_you") query = query.in("status", ["created", "ready", "waiting_for_user"]);
  if (view === "finished") query = query.in("status", ["completed", "failed", "refunded", "cancelled"]);
  if (view === "scheduled") query = query.filter("next_run_at", "not.is", null);
  const result = await query;
  if (result.error) throw new Error(result.error.message);
  return result.data as unknown as Job[];
}
export async function jobDetail(admin: Admin, userId: string, id: string): Promise<JobDetail | null> {
  const job = await ownedJob(admin, userId, id);
  if (!job) return null;
  const [messages, events, artifacts, verification, usage, checkpoint] = await Promise.all([
    admin.from("job_messages").select("id,role,content,created_at").eq("job_id", id).eq("user_id", userId).order("created_at"),
    admin.from("job_events").select("id,event_type,label,created_at").eq("job_id", id).eq("user_id", userId).order("created_at").limit(200),
    admin.from("job_artifacts").select("id,name,media_type,sha256").eq("job_id", id).eq("user_id", userId),
    admin.from("job_verifications").select("result").eq("job_id", id).eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    admin.from('job_usage').select('credits,outcome,operation_key').eq('job_id',id).eq('user_id',userId),
    admin.from('job_checkpoints').select('state').eq('job_id',id).eq('user_id',userId).eq('step','pipeline').maybeSingle(),
  ]);
  const usageRows=checked(usage);
  if(!usageRows) throw new Error('Job usage could not be read.');
  const result=checked(verification)?.result;
  return { job, messages: checked(messages), events: checked(events), artifacts: checked(artifacts), verification:result?{...result,expired:job.status!=='completed'&&!verificationIsFresh(result,job.completion_contract)}:null, usage:usageSummary(usageRows,checked(checkpoint)?.state?.billableKeys,job.is_free), browser: null } as JobDetail;
}
export async function workspaceContext(admin: Admin, userId: string): Promise<Record<string, string>> {
  const rows = checked(await admin.from("agents").select("config").eq("user_id", userId).eq("template_id", "head-agent").limit(1));
  const raw = rows?.[0]?.config ?? {};
  const keys = ["companyName", "websiteUrl", "businessContext", "icp", "audience", "competitors", "voiceSample", "brandVoice", "approvedClaims", "excludedClaims"];
  return Object.fromEntries(keys.filter(k => typeof raw[k] === "string").map(k => [k, raw[k].slice(0, 3000)]));
}
