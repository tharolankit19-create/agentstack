"use client";
import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { FileDown, ShieldCheck, Plus, Play, Pause, X, Eye } from "lucide-react";
import type { Job, JobDetail } from "@/lib/jobs/types";
import { STATE_LABELS } from "@/lib/jobs/types";

async function api<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : { cache: "no-store" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Kryx could not load this work.");
  return data as T;
}
const button = "inline-flex items-center justify-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-medium disabled:opacity-50 hover:bg-surface-2";
export function JobsWorkspace() {
  const query = useSearchParams();
  const router = useRouter();
  const view = query.get("view");
  const id = query.get("id");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [detail, setDetail] = useState<JobDetail | null>(null);
  const [text, setText] = useState("");
  const [cap, setCap] = useState(90);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const refresh = useCallback(async () => {
    try {
      if (id) { const next = await api<JobDetail>(`/api/jobs/${id}`); setDetail(next); setCap(next.job.hard_cap); }
      else { const data = await api<{ jobs: Job[] }>(`/api/jobs${view ? `?view=${view}` : ""}`); setJobs(data.jobs); setDetail(null); }
      setLoaded(true); setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load jobs."); }
  }, [id, view]);
  useEffect(() => {
    let alive = true;
    const run = () => { if (alive) void refresh(); };
    run(); const timer = setInterval(run, 4000);
    return () => { alive = false; clearInterval(timer); };
  }, [refresh]);
  useEffect(() => {
    if (!id && !view) { const saved = sessionStorage.getItem("kryx-job-goal"); if (saved) { setText(saved); sessionStorage.removeItem("kryx-job-goal"); } }
  }, [id, view]);
  async function mutate(action: string) {
    setBusy(true); setError("");
    try { await api(`/api/jobs/${id}`, { action, hardCap: cap }); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update job."); }
    finally { setBusy(false); }
  }
  async function create() {
    if (!text.trim()) return;
    setBusy(true); setError("");
    try {
      const result = await api<{ job: Job }>("/api/jobs", { goal: text.trim(), hardCap: cap });
      setText(""); router.push(`/dashboard/jobs?id=${result.job.id}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create job."); }
    finally { setBusy(false); }
  }
  const job = detail?.job;
  return <div className="mx-auto flex min-h-[75dvh] max-w-4xl flex-col gap-6">
    {error && <p role="alert" className="rounded-xl border border-line bg-surface p-4 text-sm">{error}</p>}
    {job && detail ? <>
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5">
        <div><h1 className="text-xl font-semibold leading-7">{job.instruction}</h1><p className="mt-2 text-sm text-muted">{STATE_LABELS[job.status]} · {job.credits_used}/{job.hard_cap} credits{job.is_free ? " · First verified job free" : ""}</p></div>
        <div className="flex flex-wrap gap-2">
          {detail.browser && <Link href={`/dashboard/jobs/watch?job=${job.id}`} className={button}><Eye className="size-4" />Watch</Link>}
          {["queued", "running", "recovering"].includes(job.status) && <button disabled={busy} onClick={() => void mutate("pause")} className={button}><Pause className="size-4" />Pause</button>}
          {job.status === "waiting_for_user" && <button disabled={busy} onClick={() => void mutate("resume")} className={button}><Play className="size-4" />Resume</button>}
          {!["completed", "failed", "refunded", "cancelled"].includes(job.status) && <button disabled={busy} onClick={() => void mutate("cancel")} className={button}><X className="size-4" />Cancel</button>}
        </div>
      </header>
      {job.status === "created" || job.status === "ready" ? <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="font-semibold">What counts as finished</h2>
        <ul className="mt-3 space-y-2 text-sm text-muted">{job.completion_contract.predicates.map(p => <li key={p.id}>{p.id.replaceAll("_", " ")}{p.value !== undefined ? `: ${p.value}` : ""}</li>)}</ul>
        <div className="mt-5 flex flex-wrap items-center gap-4"><span className="text-sm">Estimated {job.estimate_min}–{job.estimated_credits} credits</span><label className="text-sm">Hard cap <input aria-label="Hard credit cap" type="number" min={job.estimated_credits} max={2000} value={cap} onChange={e => setCap(Number(e.target.value))} className="ml-2 w-24 rounded-lg border border-line bg-bg p-2" /></label><button disabled={busy} onClick={() => void mutate("start")} className={`${button} bg-fg-strong text-bg`}><Play className="size-4" />Start job</button></div>
      </section> : null}
      <section aria-label="Conversation" className="space-y-4">{detail.messages.map(m => <div key={m.id} className={`whitespace-pre-wrap rounded-xl p-4 text-sm leading-6 ${m.role === "user" ? "ml-auto max-w-[90%] bg-surface-2" : "bg-surface"}`}>{m.content}</div>)}</section>
      <section className="border-t border-line pt-4"><h2 className="text-sm font-semibold">Progress</h2><ol className="mt-3 space-y-2">{detail.events.map(e => <li key={e.id} className="flex gap-3 text-sm text-muted"><time className="shrink-0 font-mono text-xs">{new Date(e.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>{e.label}</li>)}</ol></section>
      {detail.artifacts.length > 0 && <section><h2 className="text-sm font-semibold">Artifacts</h2><div className="mt-3 flex flex-wrap gap-2">{detail.artifacts.map(a => <a key={a.id} href={`/api/jobs/${job.id}/artifacts/${a.id}`} className={button}><FileDown className="size-4" />{a.name}</a>)}</div></section>}
      {detail.verification && <section className="rounded-xl border border-line p-5"><h2 className="flex items-center gap-2 font-semibold"><ShieldCheck className="size-4" />{detail.verification.passed ? "Verification passed" : "Verification did not pass"}</h2><ul className="mt-3 space-y-2 text-sm text-muted">{detail.verification.checks.map(c => <li key={c.id}>{c.passed ? "✓" : "×"} {c.id.replaceAll("_", " ")} — {c.detail}</li>)}</ul></section>}
      {job.status === "completed" && job.receipt && <section className="rounded-xl border border-line bg-surface p-5"><h2 className="text-xl font-semibold">{job.receipt.result}</h2><dl className="mt-5 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">{[
        ["Sources checked", job.receipt.sourcesChecked], ["Duplicates", job.receipt.duplicates], ["Checks passed", `${job.receipt.checksPassed}/${job.receipt.checksTotal}`], ["Credits used", job.receipt.creditsUsed], ["Reservation released", job.receipt.releasedCredits], ["Failed attempts charged", job.receipt.failedAttemptsCharged],
      ].map(([label, value]) => <div key={label}><dt className="text-muted">{label}</dt><dd className="mt-1 font-semibold">{value}</dd></div>)}</dl></section>}
      <Link href="/dashboard" className={`${button} self-start`}><Plus className="size-4" />New job</Link>
    </> : <>
      <div className={view ? "" : "mt-auto"}><h1 className="text-3xl font-semibold tracking-tight">{view ? ({ working: "Working", needs_you: "Needs You", finished: "Finished", scheduled: "Scheduled" }[view] ?? "Jobs") : "What do you want done?"}</h1></div>
      {!view && <form onSubmit={e => { e.preventDefault(); void create(); }} className="rounded-2xl border border-line bg-surface p-4 shadow-sm"><textarea autoFocus aria-label="What do you want done?" placeholder="Find 20 SaaS founders that match my ICP and prepare personalized outreach." value={text} onChange={e => setText(e.target.value)} maxLength={4000} rows={4} className="w-full resize-none bg-transparent text-base outline-none" /><div className="mt-3 flex justify-end"><button disabled={busy || !text.trim()} className={`${button} bg-fg-strong text-bg`}>{busy ? "Defining completion…" : "Prepare job"}</button></div></form>}
      <div className="space-y-2">{jobs.map(j => <Link key={j.id} href={`/dashboard/jobs?id=${j.id}`} className="block rounded-xl border border-line p-4 hover:bg-surface"><p className="font-medium">{j.instruction}</p><p className="mt-2 text-sm text-muted">{STATE_LABELS[j.status]}{j.receipt ? ` · ${j.receipt.result}` : ""} · {j.credits_used} credits</p></Link>)}{loaded && jobs.length === 0 && view && <p className="text-sm text-muted">No jobs here yet.</p>}</div>
      {!view && <p className="mb-auto text-sm text-muted">Research, lead lists, competitor scans, outreach drafts, and content. Kryx defines the checks before starting.</p>}
    </>}
  </div>;
}
