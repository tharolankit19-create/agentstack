'use client';
import { useEffect,useRef,useState } from 'react';
import type { SourceEvidenceDetail,SourceEvidencePage } from '@/lib/jobs/types';

const button='rounded-lg border border-line px-3 py-2 text-sm hover:bg-surface-2 disabled:opacity-50';
async function read<T>(url:string,signal:AbortSignal):Promise<T> {
  const response=await fetch(url,{cache:'no-store',signal});const data=await response.json();
  if(!response.ok)throw new Error(data.error??'Could not read evidence.');return data as T;
}
function Snapshot({job,id}:{job:string;id:string}) {
  const [snapshot,setSnapshot]=useState<SourceEvidenceDetail|null>(null);const [error,setError]=useState('');
  useEffect(()=>{const controller=new AbortController();
    read<SourceEvidenceDetail>(`/api/jobs/${job}/evidence/${id}`,controller.signal).then(result=>{if(!controller.signal.aborted)setSnapshot(result);}).catch(cause=>{if(!controller.signal.aborted)setError(cause instanceof Error?cause.message:'Could not read snapshot.');});
    return()=>controller.abort();
  },[job,id]);
  if(error)return <p role="alert" className="mt-3 text-sm">{error}</p>;
  if(!snapshot)return <p role="status" className="mt-3 text-sm text-muted">Loading recorded source…</p>;
  return <div className="mt-3"><p className="text-xs text-muted">Stored text integrity checked · captured {new Date(snapshot.capturedAt).toLocaleString()}</p><p className="mt-2 break-all font-mono text-xs text-muted">SHA-256 {snapshot.sha256}</p><pre className="mt-3 max-h-80 overflow-y-auto whitespace-pre-wrap break-words rounded-lg bg-surface-2 p-3 text-sm leading-6 [overflow-wrap:anywhere]">{snapshot.text}</pre></div>;
}
function safeLink(raw:string):string|undefined {
  try{const url=new URL(raw);return url.protocol==='https:'&&!url.username&&!url.password?url.href:undefined;}catch{return undefined;}
}
export function EvidencePanel({job}:{job:string}) {
  const [open,setOpen]=useState(false);const [page,setPage]=useState<SourceEvidencePage|null>(null);
  const [loading,setLoading]=useState(false);const [error,setError]=useState('');const [selected,setSelected]=useState<string|null>(null);
  const controller=useRef<AbortController|null>(null);
  useEffect(()=>()=>controller.current?.abort(),[]);
  async function load(cursor:string|null=null) {
    controller.current?.abort();const request=new AbortController();controller.current=request;setLoading(true);setError('');
    try{const result=await read<SourceEvidencePage>(`/api/jobs/${job}/evidence${cursor?`?cursor=${encodeURIComponent(cursor)}`:''}`,request.signal);
      if(request.signal.aborted)return;setPage(previous=>({sources:cursor?[...(previous?.sources??[]),...result.sources.filter(source=>!previous?.sources.some(old=>old.id===source.id))]:result.sources,nextCursor:result.nextCursor}));
    }catch(cause){if(!request.signal.aborted)setError(cause instanceof Error?cause.message:'Could not load evidence.');}
    finally{if(!request.signal.aborted)setLoading(false);}
  }
  return <section aria-label="Source evidence" className="rounded-xl border border-line p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-sm font-semibold">Evidence</h2><button className={button} aria-expanded={open} onClick={()=>{setOpen(!open);if(!open&&!page&&!loading)void load();}}>{open?'Hide sources':'View sources'}</button></div>
    {open&&<div className="mt-4 space-y-4"><p className="text-sm text-muted">Recorded research and independent source checks. These snapshots show what Kryx read during this job.</p>
      {error&&<p role="alert" className="text-sm">{error}</p>}
      {page?.sources.map(source=><article key={source.id} className="rounded-lg border border-line p-3"><p className="text-xs text-muted">{source.phase==='verification'?'Independent check':source.phase==='research'?'Research source':'Source'} · HTTP {source.status} · {new Date(source.capturedAt).toLocaleString()}</p><a href={safeLink(source.sourceUrl)} target="_blank" rel="noopener noreferrer" className="mt-2 block break-all text-sm underline underline-offset-4">{source.sourceUrl}</a><button className={`${button} mt-3`} aria-expanded={selected===source.id} onClick={()=>setSelected(selected===source.id?null:source.id)}>{selected===source.id?'Hide recorded text':'View recorded text'}</button>{selected===source.id&&<Snapshot key={source.id} job={job} id={source.id}/>}</article>)}
      {loading&&<p role="status" className="text-sm text-muted">Loading source evidence…</p>}
      {page&&!page.sources.length&&!loading&&<p className="text-sm text-muted">No source snapshots recorded yet.</p>}
      <div className="flex flex-wrap gap-2">{page?.nextCursor&&<button disabled={loading} className={button} onClick={()=>void load(page.nextCursor)}>More sources</button>}<button disabled={loading} className={button} onClick={()=>void load()}>Refresh sources</button></div>
    </div>}
  </section>;
}
