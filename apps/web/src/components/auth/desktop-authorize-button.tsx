"use client";

import { useState } from "react";

export function DesktopAuthorizeButton({ requestId }: { requestId: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function approve() {
    if (pending) return;
    setPending(true);
    setError(null);

    const response = await fetch("/api/desktop/auth/approve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ requestId }),
    });
    const data = (await response.json().catch(() => ({}))) as {
      redirectUrl?: string;
      error?: string;
    };

    if (!response.ok || !data.redirectUrl) {
      setError(data.error ?? "Could not authorize Kryx Desktop.");
      setPending(false);
      return;
    }

    window.location.assign(data.redirectUrl);
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => void approve()}
        disabled={pending}
        className="inline-flex w-full items-center justify-center rounded-xl bg-fg-strong px-4 py-3 text-sm font-bold text-bg disabled:opacity-50"
      >
        {pending ? "Opening Kryx…" : "Continue to Kryx Desktop"}
      </button>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
