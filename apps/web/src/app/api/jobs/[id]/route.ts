import { z } from "zod";
import { requireApiUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { jobDetail } from "@/lib/jobs/store";
import { jobFlags } from "@/lib/jobs/flags";
export const dynamic = "force-dynamic";
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(); if (!auth.ok) return auth.response;
  if (!jobFlags().jobs) return Response.json({ error: "Jobs are disabled." }, { status: 404 });
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return Response.json({ error: "Invalid job." }, { status: 400 });
  try { const detail = await jobDetail(createAdminClient(), auth.session.userId, id); return detail ? Response.json(detail) : Response.json({ error: "Job not found." }, { status: 404 }); }
  catch { return Response.json({ error: "Job storage is unavailable." }, { status: 503 }); }
}
const actionInput=z.object({action:z.enum(['start','pause','resume','cancel']),hardCap:z.number().int().min(1).max(2000).optional()}).strict();
export const runtime='nodejs';export const maxDuration=300;
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}) {
 const auth=await requireApiUser();if(!auth.ok)return auth.response;
 if(!jobFlags().jobs||!jobFlags().verification||!jobFlags().refunds)return Response.json({error:'Verified execution is not enabled yet.'},{status:503});
 const {id}=await params;const body=actionInput.safeParse(await req.json().catch(()=>null));
 if(!z.uuid().safeParse(id).success||!body.success)return Response.json({error:'Invalid job action.'},{status:400});
 const admin=createAdminClient();
 try {
  const {ownedJob,checked}=await import('@/lib/jobs/store');const job=await ownedJob(admin,auth.session.userId,id);
  if(!job)return Response.json({error:'Job not found.'},{status:404});
  if(body.data.action==='start') {
   if(job.task_class!=='LEAD_LIST')return Response.json({error:'This rollout currently supports verified Lead List jobs. Other classes are not enabled.'},{status:409});
   checked(await admin.rpc('start_verified_job',{p_job:id,p_user:auth.session.userId,p_cap:body.data.hardCap??job.hard_cap}));
  } else if(body.data.action==='resume') {
   checked(await admin.rpc('resume_verified_job',{p_job:id,p_user:auth.session.userId,p_cap:body.data.hardCap??job.hard_cap}));
  } else {
   const ok=checked(await admin.rpc('control_verified_job',{p_job:id,p_user:auth.session.userId,p_action:body.data.action}));
   if(!ok)return Response.json({error:'This action is not available in the current job state.'},{status:409});
  }
  if(['start','resume'].includes(body.data.action)) {
   const {after}=await import('next/server');
   after(async()=>{const {advanceJobs}=await import('@/lib/jobs/worker');await advanceJobs();});
  }
  return Response.json({ok:true});
 }catch(cause){const message=cause instanceof Error?cause.message:'Job update failed';console.error('[jobs] action failed',message);return Response.json({error:message.includes('credits')?'Not enough available credits to reserve this cap.':message.includes('higher cap')?'Choose a higher hard cap before resuming this job.':message.includes('hard cap')?'The cap must be a whole number within the allowed range.':message.includes('concurrent')?'Your concurrent job limit has been reached.':'Could not update the job safely.'},{status:409});}
}
