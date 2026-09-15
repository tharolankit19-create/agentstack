
"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
export function FeedbackReview({id,status,improvement}:{id:string;status:string;improvement:string}) {
 const [note,setNote]=useState(""),[triage,setTriage]=useState(improvement),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const router=useRouter();
 async function decide(decision:string) {
  setBusy(true);setError("");
  try {
   const r=await fetch("/api/admin/feedback",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,decision,note,improvement:triage})});
   const p=await r.json();if(!r.ok)throw new Error(p.error);router.refresh();
  } catch(e){setError(e instanceof Error?e.message:"Review failed.");} finally{setBusy(false);}
 }
 return <div className="mt-4 space-y-3">
  <label className="block text-sm">Improvement status<select aria-label="Improvement status" value={triage} onChange={e=>setTriage(e.target.value)} className="ml-3 rounded border border-line bg-surface p-2">
   {["new","planned","working","shipped","not_planned"].map(x=><option key={x}>{x}</option>)}</select></label>
  <textarea aria-label="Decision reason, visible to the customer" value={note} maxLength={2000} onChange={e=>setNote(e.target.value)} placeholder="Explain the decision. This note is visible to the customer." className="w-full rounded border border-line bg-surface p-3"/>
  <div className="flex flex-wrap gap-3">
   {(status==="submitted"||status==="rejected")?<button disabled={busy||note.trim().length<8} onClick={()=>void decide("approve")} className="rounded bg-accent px-3 py-2 text-accent-fg disabled:opacity-40">Approve · grant $2 once</button>:null}
   {status==="submitted"?<button disabled={busy||note.trim().length<8} onClick={()=>void decide("reject")} className="rounded border border-line px-3 py-2 disabled:opacity-40">Decline with reason</button>:null}
   <button disabled={busy||note.trim().length<8} onClick={()=>void decide("triage")} className="rounded border border-line px-3 py-2 disabled:opacity-40">{busy?"Saving…":"Save improvement status"}</button>
  </div>{error?<p role="alert" className="text-danger">{error}</p>:null}
 </div>;
}
