
import { requireApiUser } from "@/lib/auth";
import { isAdmin } from "@/lib/plans";
import { createAdminClient } from "@/lib/supabase/admin";
export async function POST(request: Request) {
 const auth=await requireApiUser(); if(!auth.ok)return auth.response;
 if(!isAdmin(auth.session.profile))return Response.json({error:"Not found."},{status:404});
 let b: Record<string,unknown>; try {b=await request.json();} catch{return Response.json({error:"Invalid request."},{status:400});}
 if(!b || typeof b.id!=="string" || !/^[0-9a-f-]{36}$/i.test(b.id) ||
  !["approve","reject","triage"].includes(String(b.decision)) ||
  typeof b.note!=="string" || b.note.trim().length<8 || b.note.length>2000 ||
  !["new","planned","working","shipped","not_planned"].includes(String(b.improvement))) {
  return Response.json({error:"Choose a decision and explain it (8–2,000 characters)."},{status:400});
 }
 const {data,error}=await createAdminClient().rpc("review_founder_feedback",{
  p_session_id:b.id,p_reviewer:auth.session.userId,p_decision:b.decision,p_note:b.note.trim(),p_improvement:b.improvement,
 });
 if(error)return Response.json({error:"Could not apply this decision. Refresh the review and try again."},{status:409});
 return Response.json(data);
}
