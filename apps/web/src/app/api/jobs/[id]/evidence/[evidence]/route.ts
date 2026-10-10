import { z } from 'zod';
import { requireApiUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { jobFlags } from '@/lib/jobs/flags';
import { sourceEvidenceDetail } from '@/lib/jobs/evidence-store';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private,no-store','X-Content-Type-Options':'nosniff'};
export async function GET(_req:Request,{params}:{params:Promise<{id:string;evidence:string}>}) {
  const auth=await requireApiUser();if(!auth.ok)return auth.response;
  if(!jobFlags().jobs)return Response.json({error:'Jobs are disabled.'},{status:404,headers});
  const {id,evidence}=await params;
  if(!z.uuid().safeParse(id).success||!z.uuid().safeParse(evidence).success)return Response.json({error:'Invalid evidence request.'},{status:400,headers});
  try{const source=await sourceEvidenceDetail(createAdminClient(),auth.session.userId,id,evidence);return source?Response.json(source,{headers}):Response.json({error:'Source evidence not found.'},{status:404,headers});}
  catch(cause){const corrupt=cause instanceof Error&&cause.message==='Evidence integrity check failed';return Response.json({error:corrupt?'Evidence integrity check failed.':'Evidence storage is unavailable.'},{status:corrupt?409:503,headers});}
}
