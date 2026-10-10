import { after } from 'next/server';
import { authorizeCron } from '@/lib/cron-auth';
import { advanceJobs } from '@/lib/jobs/worker';
export const runtime='nodejs';export const maxDuration=300;export const dynamic='force-dynamic';
export async function GET(request:Request){
 if(!await authorizeCron(request))return Response.json({error:'Unauthorized'},{status:401});
 after(async()=>{await advanceJobs();});
 return Response.json({accepted:true},{status:202});
}
