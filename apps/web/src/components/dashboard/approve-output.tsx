"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePaywall } from "./paywall";

export function ApproveOutput({ id, approved }: { id: string; approved: boolean }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(approved);
  const [error, setError] = useState("");
  const { guard } = usePaywall();
  const router = useRouter();
  async function approve() {
    if (busy || done) return;
    setBusy(true); setError("");
    try {
      const result = await guard(() => fetch(`/api/generations/${id}`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      }));
      if (result) { setDone(true); router.refresh(); }
    } catch (e) { setError(e instanceof Error ? e.message : "Approval failed."); }
    finally { setBusy(false); }
  }
  return <div className="mt-4 flex flex-wrap items-center gap-3">
    <button disabled={busy || done} onClick={approve} className="rounded-lg bg-accent px-4 py-2 text-sm font-bold text-accent-fg disabled:opacity-60">
      {done ? "Approved" : busy ? "Saving approval…" : "Approve draft"}
    </button>
    <a href={`/api/generations/${id}`} className="text-sm underline">Download .md</a>
    <span className="text-sm text-muted">Approval saves your decision. Publishing is a separate action.</span>
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
  </div>;
}
