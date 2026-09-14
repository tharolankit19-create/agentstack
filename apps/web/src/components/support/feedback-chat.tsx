
"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { nextFeedbackQuestion, type FeedbackSession } from "@/lib/feedback-contract";
export function FeedbackChat() {
 const [session,setSession]=useState<FeedbackSession|null>(null);
 const [loading,setLoading]=useState(true), [busy,setBusy]=useState(false);
 const [answer,setAnswer]=useState(""), [error,setError]=useState("");
 const lock=useRef(false), end=useRef<HTMLDivElement>(null);
 const router=useRouter();
 useEffect(()=>{const controller=new AbortController();
  fetch("/api/feedback",{signal:controller.signal,cache:"no-store"}).then(async r=>{
   const p=await r.json(); if(!r.ok) throw new Error(p.error||"Could not load feedback."); setSession(p.session);
  }).catch(e=>{if(e.name!=="AbortError")setError(e.message);}).finally(()=>setLoading(false));
  return ()=>controller.abort();
 },[]);
 useEffect(()=>{end.current?.scrollIntoView({block:"nearest"});},[session?.version,session?.status]);
 async function send(action:string) {
  if(lock.current)return; lock.current=true;setBusy(true);setError("");
  try {
   const r=await fetch("/api/feedback",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({action,answer,version:session?.version})});
   const p=await r.json(); if(p.session)setSession(p.session);
   if(!r.ok)throw new Error(p.error||"Could not save feedback.");
   if(action==="answer")setAnswer("");
   if(p.session?.status==="rewarded")router.refresh();
  }catch(e){setError(e instanceof Error?e.message:"Could not save feedback.");}
  finally{lock.current=false;setBusy(false);}
 }
 const question=session?nextFeedbackQuestion(session.answers,(session.usage_snapshot.outputs??0)>0):null;
 return <div className="min-h-0 overflow-y-auto p-4 text-sm">
  <p className="font-bold text-fg-strong">Chat with us. Get $2 in credits.</p>
  <p className="mt-2 text-xs leading-relaxed text-muted">Six questions about your real experience. Your answers and usage counts are saved for the Kryx team to review. Specific, completed feedback earns 200 credits after review, once per account. Positive and negative feedback qualify equally. No passwords or customer secrets, please.</p>
  {loading?<p role="status" className="mt-4">Loading your saved chat…</p>:null}
  {!loading&&!session?<button disabled={busy} onClick={()=>void send("start")} className="mt-4 rounded-lg bg-accent px-4 py-2 text-accent-fg disabled:opacity-50">{busy?"Starting…":"Start feedback chat"}</button>:null}
  {session?.answers.map((turn,i)=><div key={i} className="mt-5 space-y-2"><p className="rounded-lg bg-surface-2 p-3">{turn.question}</p><p className="ml-5 whitespace-pre-wrap rounded-lg border border-line p-3">{turn.answer}</p><p className="text-right text-xs text-muted">Saved</p></div>)}
  {session?.status==="draft"&&question?<form className="mt-5 space-y-3" onSubmit={e=>{e.preventDefault();void send("answer");}}>
   <p className="text-xs text-muted">Question {session.answers.length+1} of 6 · You can close this and resume later.</p>
   <label htmlFor="founder-feedback-answer" className="block rounded-lg bg-surface-2 p-3">{question}</label>
   <textarea id="founder-feedback-answer" rows={4} maxLength={3000} value={answer} onChange={e=>setAnswer(e.target.value)}
    placeholder="A real example is more useful than a perfect answer." className="w-full rounded-lg border border-line bg-bg p-3" disabled={busy}/>
   <button disabled={busy||!answer.trim()} className="rounded-lg bg-accent px-4 py-2 text-accent-fg disabled:opacity-50">{busy?"Saving…":"Save & continue"}</button>
  </form>:null}
  {session?.status==="draft"&&!question?<div className="mt-5"><p>Your six answers are saved. Submit them for review to claim your credits.</p><button disabled={busy} onClick={()=>void send("submit")} className="mt-3 rounded-lg bg-accent px-4 py-2 text-accent-fg disabled:opacity-50">{busy?"Submitting…":"Submit feedback"}</button></div>:null}
  {session&&session.status!=="draft"?<div role="status" className="mt-5 rounded-lg border border-line p-3">
   <p>{session.status==="rewarded"?"Thank you — $2 (200 credits) was added to your work balance.":session.status==="submitted"?"Saved and submitted. The team will review your examples; your reward status will appear here.":"The team reviewed your feedback. Credits have not been granted."}</p>
   {session.review_note?<p className="mt-2">Team note: {session.review_note}</p>:null}
   <button className="mt-3 underline" disabled={busy} onClick={()=>void send("start")}>Refresh status</button>
  </div>:null}
  {error?<p role="alert" className="mt-3 text-danger">{error}</p>:null}
  <div ref={end}/>
 </div>;
}
