"use client";

import { useState } from "react";

export function MissionRetry({ missionId }: { missionId: string }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function retry() {
    if (busy || done) return;
    setBusy(true);
    setError(null);

    const response = await fetch(`/api/missions/hybrid/${missionId}/resume`, {
      method: "POST",
    });
    const body = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
    };

    if (!response.ok || !body.ok) {
      setError(body.error ?? "Could not retry this mission.");
      setBusy(false);
      return;
    }

    setDone(true);
    setBusy(false);
    window.location.reload();
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => void retry()}
        disabled={busy || done}
        className="rounded-lg bg-fg-strong px-3 py-2 text-[13px] font-bold text-bg disabled:opacity-50"
      >
        {done ? "Queued" : busy ? "Retrying…" : "Retry after fixing blocker"}
      </button>
      {error ? <p className="mt-2 text-[12px] text-danger">{error}</p> : null}
    </div>
  );
}
