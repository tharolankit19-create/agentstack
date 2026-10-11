import { z } from 'zod';
import { requireApiUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { jobFlags } from '@/lib/jobs/flags';
import { evidenceCursor } from '@/lib/jobs/evidence';
import { sourceEvidencePage } from '@/lib/jobs/evidence-store';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private,no-store','X-Content-Type-Options':'nosniff'};
export async function GET(req:Request,{params}:{params:Promise<{id:string}>}) {
  const auth=await requireApiUser();if(!auth.ok)return auth.response;
  if(!jobFlags().jobs)return Response.json({error:'Jobs are disabled.'},{status:404,headers});
  const {id}=await params;const cursor=new URL(req.url).searchParams.get('cursor');
  try{if(!z.uuid().safeParse(id).success)throw new Error('Invalid job');evidenceCursor(cursor);}
  catch{return Response.json({error:'Invalid evidence request.'},{status:400,headers});}
  try{const page=await sourceEvidencePage(createAdminClient(),auth.session.userId,id,cursor);return page?Response.json(page,{headers}):Response.json({error:'Job not found.'},{status:404,headers});}
  catch{return Response.json({error:'Evidence storage is unavailable.'},{status:503,headers});}
}
