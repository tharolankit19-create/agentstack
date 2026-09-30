"use client";

import { useState } from "react";

export function DeviceActions({
  id,
  revoked,
}: {
  id: string;
  revoked: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [gone, setGone] = useState(revoked);
  const [error, setError] = useState<string | null>(null);

  async function disconnect() {
    if (busy || gone) return;
    setBusy(true);
    setError(null);

    const response = await fetch(`/api/devices/${id}`, { method: "DELETE" });
    const body = (await response.json().catch(() => ({}))) as { error?: string };

    if (!response.ok) {
      setError(body.error ?? "Could not disconnect this device.");
      setBusy(false);
      return;
    }

    setGone(true);
    setBusy(false);
  }

  if (gone) {
    return <span className="text-[12px] font-semibold text-faint">Revoked</span>;
  }

  return (
    <div>
      <button
        type="button"
        disabled={busy}
        onClick={() => void disconnect()}
        className="rounded-lg border border-line px-3 py-2 text-[12px] font-semibold text-muted hover:border-line-strong hover:text-fg disabled:opacity-50"
      >
        {busy ? "Disconnecting…" : "Disconnect"}
      </button>
      {error ? <p className="mt-1 text-[11px] text-danger">{error}</p> : null}
    </div>
  );
}
