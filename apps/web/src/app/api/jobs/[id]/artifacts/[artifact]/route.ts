import { z } from 'zod';
import { requireApiUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { digest } from '@/lib/jobs/verification';
export const dynamic='force-dynamic';
export async function GET(_req:Request,{params}:{params:Promise<{id:string;artifact:string}>}){
 const auth=await requireApiUser();if(!auth.ok)return auth.response;
 const {id,artifact}=await params;if(!z.uuid().safeParse(id).success||!z.uuid().safeParse(artifact).success)return Response.json({error:'Invalid artifact'},{status:400});
 const {data,error}=await createAdminClient().from('job_artifacts').select('name,media_type,content,sha256').eq('job_id',id).eq('user_id',auth.session.userId).eq('id',artifact).maybeSingle();
 if(error)return Response.json({error:'Artifact storage unavailable'},{status:503});if(!data)return Response.json({error:'Artifact not found'},{status:404});
 if(digest(data.content)!==data.sha256)return Response.json({error:'Artifact integrity check failed'},{status:409});
 return new Response(data.content,{headers:{'content-type':`${data.media_type}; charset=utf-8`,'content-disposition':`attachment; filename="${data.name}"`,'cache-control':'private,no-store','x-content-type-options':'nosniff'}});
}
