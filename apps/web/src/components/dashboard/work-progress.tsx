"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { RoomLine } from "@/lib/room";

export function WorkProgress({ agentId }: { agentId: string }) {
  const [lines, setLines] = useState<RoomLine[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    async function refresh() {
      if (document.hidden) return;
      try {
        const res = await fetch(`/api/room?agent=${encodeURIComponent(agentId)}`, { cache: "no-store" });
        if (!res.ok) throw new Error("Progress is temporarily unavailable.");
        const data = await res.json();
        if (live) { setLines(data.messages || []); setError(""); }
      } catch { if (live) setError("Progress is temporarily unavailable. Retrying…"); }
    }
    void refresh(); const timer = setInterval(refresh, 3000);
    return () => { live = false; clearInterval(timer); };
  }, [agentId]);
  return <details id="work-progress" open className="rounded-xl border border-line bg-surface-2 p-4">
    <summary className="cursor-pointer text-sm font-bold">Work log · actual tool activity</summary>
    <div className="mt-3 max-h-56 space-y-2 overflow-y-auto text-sm">
      {!lines.length && !error && <p className="text-muted">Sources and saved deliverables will appear here as the agent works.</p>}
      {lines.map(line => <div key={line.id} className="border-l border-line pl-3">
        <p className="whitespace-pre-wrap">{line.body}</p>
        {line.generation_id && <Link className="text-accent underline" href={`/dashboard/outputs/${line.generation_id}`}>Open deliverable</Link>}
      </div>)}
      {error && <p role="status">{error}</p>}
    </div>
  </details>;
}
