import { z } from "zod";
import { requireApiUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { completionContract, estimateContract } from "@/lib/jobs/contracts";
import { checked, listJobs, workspaceContext } from "@/lib/jobs/store";
import { jobFlags } from "@/lib/jobs/flags";
import { rateLimit } from "@/lib/rate-limit";
import { publicJob } from '@/lib/jobs/public-job';
export const dynamic = "force-dynamic";
const input = z.object({ goal: z.string().trim().min(5).max(4000), hardCap: z.number().int().min(1).max(2000).optional(), requestKey: z.uuid() });
const viewSchema = z.enum(["working", "needs_you", "finished", "scheduled"]);
export async function GET(req: Request) {
  const auth = await requireApiUser(); if (!auth.ok) return auth.response;
  if (!jobFlags().jobs) return Response.json({ error: "Jobs are not enabled yet." }, { status: 404 });
  const view = viewSchema.safeParse(new URL(req.url).searchParams.get("view"));
  try { return Response.json({ jobs: await listJobs(createAdminClient(), auth.session.userId, view.success ? view.data : undefined) },{headers:{'Cache-Control':'private,no-store'}}); }
  catch { return Response.json({ error: "Job storage is unavailable. Check the V2 migration." }, { status: 503 }); }
}
export async function POST(req: Request) {
  const auth = await requireApiUser(); if (!auth.ok) return auth.response;
  if (!jobFlags().jobs || !jobFlags().verification) return Response.json({ error: "Verified jobs are not enabled yet." }, { status: 503 });
  if (!rateLimit(`jobs:${auth.session.userId}`, 30, 3600).allowed) return Response.json({ error: "Too many new jobs. Try again shortly." }, { status: 429 });
  const parsed = input.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Provide a goal and a valid request key." }, { status: 400 });
  try {
    const admin = createAdminClient();
    const contract = completionContract(parsed.data.goal, await workspaceContext(admin, auth.session.userId));
    if (contract.taskClass !== "LEAD_LIST") return Response.json({ error: "This beta currently verifies lead lists and their outreach drafts. Other job types are not enabled yet." }, { status: 409 });
    const estimate = estimateContract(contract);
    const cap = parsed.data.hardCap ?? Math.max(90, estimate.max);
    if (cap < estimate.max) return Response.json({ error: `This job needs a cap of at least ${estimate.max} credits.` }, { status: 400 });
    const job = checked(await admin.rpc("create_verified_job", { p_user_id: auth.session.userId, p_goal: parsed.data.goal, p_contract: contract, p_min: estimate.min, p_max: estimate.max, p_cap: cap, p_key: parsed.data.requestKey }));
    return Response.json({ job:publicJob(job) }, { status: 201,headers:{'Cache-Control':'private,no-store'} });
  } catch (cause) { if (cause instanceof Error && /Which customer profile|1–50/.test(cause.message)) return Response.json({ error: cause.message }, { status: 422 }); console.error("[jobs] creation failed", cause instanceof Error ? cause.message : "Unknown error"); return Response.json({ error: "Could not save this job. Check V2 storage and try again." }, { status: 503 }); }
}
