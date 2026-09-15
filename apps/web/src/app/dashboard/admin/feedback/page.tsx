
import Link from "next/link";
import {notFound} from "next/navigation";
import {requireUser} from "@/lib/auth";
import {isAdmin} from "@/lib/plans";
import {createAdminClient} from "@/lib/supabase/admin";
import {feedbackFlags,type FeedbackSession} from "@/lib/feedback-contract";
import {FeedbackReview} from "@/components/dashboard/feedback-review";
export const dynamic="force-dynamic";
export default async function FeedbackAdmin({searchParams}:{searchParams:Promise<{status?:string;page?:string}>}) {
 const auth=await requireUser("/dashboard/admin/feedback");if(!isAdmin(auth.profile))notFound();
 const params=await searchParams;
 const status=["draft","submitted","rewarded","rejected"].includes(params.status??"")?params.status!:"submitted";
 const page=Math.max(0,Math.min(10000,Number.parseInt(params.page??"0")||0));
 const admin=createAdminClient();
 const {data,error,count}=await admin.from("feedback_sessions").select("*",{count:"exact"}).eq("status",status)
  .order("updated_at",{ascending:false}).order("id").range(page*20,page*20+19);
 if(error) return <p role="alert">Feedback could not be loaded. Check that migration 0024 has been applied.</p>;
 const rows=(data??[]) as FeedbackSession[];
 const profiles=rows.length?await admin.from("profiles").select("id,email").in("id",rows.map(r=>r.user_id)):{data:[],error:null};
 return <div className="max-w-4xl space-y-6">
  <Link href="/dashboard/admin" className="text-sm underline">Back to admin</Link>
  <h1 className="text-3xl font-bold">Founder feedback</h1>
  <p className="text-muted">Review real examples, including failures and onboarding blockers. Never require praise, a public review, or a positive rating. Flags prompt review; they do not prove dishonesty. Approval adds $2 once per account.</p>
  <nav className="flex flex-wrap gap-4">{["submitted","rewarded","rejected","draft"].map(s=><Link className={s===status?"font-bold underline":"text-muted"} key={s} href={"?status="+s}>{s}</Link>)}</nav>
  <p>{count??0} interviews · page {page+1}</p>
  {profiles.error?<p role="alert">User emails could not be loaded. Account IDs are shown.</p>:null}
  {rows.map(r=><article key={r.id} className="rounded-xl border border-line p-5">
   <h2 className="font-bold">{profiles.data?.find(p=>p.id===r.user_id)?.email??r.user_id}</h2>
   <p className="text-xs text-muted">{r.user_id} · {r.status} · {r.submitted_at??r.created_at}</p>
   <p className="mt-2 text-sm">{r.usage_snapshot.outputs??0} saved outputs · {r.usage_snapshot.agents??0} agents at interview start · latest output: {r.usage_snapshot.latestOutputAt??"none"}</p>
   {r.usage_snapshot.latestOutputExcerpt?<blockquote className="mt-2 rounded bg-surface-2 p-3 text-sm">Latest output ({r.usage_snapshot.latestOutputKind}): {r.usage_snapshot.latestOutputExcerpt}</blockquote>:null}
   {feedbackFlags(r.answers,r.usage_snapshot.outputs??0).map(f=><p key={f} className="mt-1 text-xs text-muted">{f}</p>)}
   <dl className="mt-4 space-y-4">{r.answers.map((a,i)=><div key={i}><dt className="font-semibold">{i+1}. {a.question}</dt><dd className="mt-1 whitespace-pre-wrap text-muted">{a.answer}</dd></div>)}</dl>
   {r.review_note?<p className="mt-4 text-sm">Last team note: {r.review_note}</p>:null}
   <FeedbackReview id={r.id} status={r.status} improvement={r.improvement_status}/>
  </article>)}
  {!rows.length?<p>No interviews in this view yet.</p>:null}
  <nav className="flex gap-4">{page>0?<Link href={"?status="+status+"&page="+(page-1)}>Previous</Link>:null}{(page+1)*20<(count??0)?<Link href={"?status="+status+"&page="+(page+1)}>Next</Link>:null}</nav>
 </div>;
}
