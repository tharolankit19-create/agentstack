
import { requireApiUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { nextFeedbackQuestion, type FeedbackSession } from "@/lib/feedback-contract";
import { rateLimit } from "@/lib/rate-limit";
export const dynamic = "force-dynamic";
const reply = (data: unknown, status=200) => Response.json(data,{status,headers:{"Cache-Control":"no-store"}});
export async function GET() {
 const auth=await requireApiUser(); if(!auth.ok) return auth.response;
 const {data,error}=await createAdminClient().from("feedback_sessions").select("*").eq("user_id",auth.session.userId).maybeSingle();
 return error ? reply({error:"Feedback is unavailable. Please try again."},503) : reply({session:data});
}
export async function POST(request: Request) {
 const auth=await requireApiUser(); if(!auth.ok) return auth.response;
 if(!rateLimit("feedback:"+auth.session.userId,60,3600).allowed) return reply({error:"Please wait before sending more feedback."},429);
 const raw=await request.text(); if(raw.length>10000) return reply({error:"Message is too long."},413);
 let body: { action?: string; version?: number; answer?: string };
 try { body=JSON.parse(raw); } catch { return reply({error:"Invalid request."},400); }
 if(!body || typeof body!=="object") return reply({error:"Invalid request."},400);
 const admin=createAdminClient(), userId=auth.session.userId;
 const found=await admin.from("feedback_sessions").select("*").eq("user_id",userId).maybeSingle();
 if(found.error) return reply({error:"Could not load your feedback."},503);
 let session=found.data as FeedbackSession | null;
 if(!session && body.action==="start") {
  const [outputs,agents,latest]=await Promise.all([
   admin.from("generations").select("id",{count:"exact",head:true}).eq("user_id",userId),
   admin.from("agents").select("id",{count:"exact",head:true}).eq("user_id",userId),
   admin.from("generations").select("created_at,kind,content").eq("user_id",userId).order("created_at",{ascending:false}).limit(1),
  ]);
  if(outputs.error||agents.error||latest.error) return reply({error:"Could not load your usage context. Try again."},503);
  const inserted=await admin.from("feedback_sessions").upsert({user_id:userId,usage_snapshot:{
   outputs:outputs.count??0,agents:agents.count??0,latestOutputAt:latest.data?.[0]?.created_at??null,
   latestOutputKind:latest.data?.[0]?.kind??null, latestOutputExcerpt:typeof latest.data?.[0]?.content==="string"?latest.data[0].content.slice(0,240):null,
  }},{onConflict:"user_id",ignoreDuplicates:true});
  if(inserted.error) return reply({error:"Could not start feedback."},503);
  const loaded=await admin.from("feedback_sessions").select("*").eq("user_id",userId).single();
  if(loaded.error) return reply({error:"Could not load feedback."},503);
  session=loaded.data as FeedbackSession;
 }
 if(!session) return reply({error:"Start the interview first."},409);
 if(body.action==="start") return reply({session});
 if(session.status!=="draft") return reply({session,error:"This interview has already been submitted."},409);
 if(body.version!==session.version) return reply({session,error:"This chat changed in another tab. Your saved answers have been refreshed."},409);
 let patch: Record<string,unknown>;
 if(body.action==="answer") {
  if(typeof body.answer!=="string" || !body.answer.trim() || body.answer.length>3000) return reply({error:"Write an answer of 1–3,000 characters."},400);
  const question=nextFeedbackQuestion(session.answers,(session.usage_snapshot.outputs??0)>0,session.usage_snapshot);
  if(!question) return reply({error:"All answers are saved. Submit the interview."},409);
  patch={answers:[...session.answers,{question,answer:body.answer.trim()}]};
 } else if(body.action==="submit" && session.answers.length===6) {
  patch={status:"submitted",submitted_at:new Date().toISOString()};
 } else return reply({error:"Complete the six questions before submitting."},400);
 const saved=await admin.from("feedback_sessions").update({...patch,version:session.version+1,updated_at:new Date().toISOString()})
  .eq("id",session.id).eq("user_id",userId).eq("status","draft").eq("version",session.version).select("*").maybeSingle();
 if(saved.error) return reply({error:"Could not save. Your message is still here; try again."},503);
 if(!saved.data) return reply({error:"This chat changed in another tab. Reopen it to refresh."},409);
 return reply({session:saved.data});
}
