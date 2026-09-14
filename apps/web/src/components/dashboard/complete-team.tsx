"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export function CompleteTeam({ missing }: { missing: string[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = useRef(false);
  if (!missing.length) return null;
  async function complete() {
    if (active.current) return;
    active.current = true; setBusy(true); setError(null);
    try {
      const response = await fetch("/api/army/deploy", { method: "POST", signal: AbortSignal.timeout(60_000) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Your team could not be set up.");
      if (result.remaining) setError(result.message || "Some agents could not be added. Check your plan and retry.");
      router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not reach your team."); }
    finally { active.current = false; setBusy(false); }
  }
  return <div className="mt-3 rounded-lg border border-line bg-surface-2 p-3"><p className="text-sm text-fg">Add the missing roles: {missing.join(", ")}.</p><button type="button" disabled={busy} onClick={() => void complete()} className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-lg bg-accent px-3 text-sm font-semibold text-accent-fg disabled:opacity-60">{busy && <Loader2 className="size-4 animate-spin" />}{busy ? "Setting up your team…" : "Complete my team"}</button>{error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}</div>;
}
