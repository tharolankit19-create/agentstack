import { after } from 'next/server';
import { authorizeCron } from '@/lib/cron-auth';
import { advanceJobs } from '@/lib/jobs/worker';
import { jobFlags } from '@/lib/jobs/flags';
export const runtime='nodejs';export const maxDuration=300;export const dynamic='force-dynamic';
export async function GET(request:Request){
 if(!await authorizeCron(request))return Response.json({error:'Unauthorized'},{status:401});
 const flags=jobFlags();
 if(!flags.jobs||!flags.verification||!flags.refunds)return Response.json({error:'Verified job execution is disabled.'},{status:503});
 after(async()=>{await advanceJobs();});
 return Response.json({accepted:true},{status:202});
}
