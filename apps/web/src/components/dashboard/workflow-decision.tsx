"use client";

import { useState } from "react";

export function WorkflowDecision({
  id,
  initialMode,
}: {
  id: string;
  initialMode: string;
}) {
  const [mode, setMode] = useState(initialMode);
  const [busy, setBusy] = useState<"shadow" | "ignore" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: "shadow" | "ignore") {
    if (busy) return;
    setBusy(decision);
    setError(null);

    const response = await fetch(`/api/workflows/${id}/decision`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    const body = (await response.json().catch(() => ({}))) as {
      workflow?: { mode?: string; status?: string };
      error?: string;
    };

    if (!response.ok || !body.workflow) {
      setError(body.error ?? "Could not update this workflow.");
      setBusy(null);
      return;
    }

    setMode(body.workflow.mode ?? mode);
    setBusy(null);
  }

  if (mode === "shadow") {
    return (
      <div>
        <span className="rounded-full border border-line bg-bg px-2.5 py-1 text-[12px] font-semibold text-muted">
          Shadow Mode
        </span>
        <p className="mt-2 text-[12px] leading-relaxed text-faint">
          Kryx will compare its proposed execution with your next matching routine. It will not take over the workflow.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={Boolean(busy)}
        onClick={() => void decide("shadow")}
        className="rounded-lg bg-fg-strong px-3 py-2 text-[13px] font-bold text-bg disabled:opacity-50"
      >
        {busy === "shadow" ? "Saving…" : "Try in Shadow Mode"}
      </button>
      <button
        type="button"
        disabled={Boolean(busy)}
        onClick={() => void decide("ignore")}
        className="rounded-lg border border-line px-3 py-2 text-[13px] font-semibold text-muted hover:border-line-strong hover:text-fg disabled:opacity-50"
      >
        {busy === "ignore" ? "Ignoring…" : "Ignore"}
      </button>
      {error ? <p className="basis-full text-[12px] text-danger">{error}</p> : null}
    </div>
  );
}
