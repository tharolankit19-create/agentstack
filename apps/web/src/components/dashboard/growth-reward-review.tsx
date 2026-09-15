"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function GrowthRewardReview({
  id,
  status,
  credits,
}: {
  id: string;
  status: string;
  credits: number;
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function decide(decision: "approve" | "reject") {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/growth-rewards", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, decision, note }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Review failed.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Review failed.");
    } finally {
      setBusy(false);
    }
  }

  if (status !== "submitted") return null;

  return (
    <div className="mt-4 space-y-3">
      <textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        maxLength={1000}
        placeholder="What did you verify?"
        className="w-full rounded-xl border border-line bg-surface-2 p-3 text-sm text-fg"
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || note.trim().length < 4}
          onClick={() => void decide("approve")}
          className="rounded-xl bg-accent px-3 py-2 text-sm font-bold text-accent-fg disabled:opacity-40"
        >
          Approve · {credits} credits
        </button>
        <button
          type="button"
          disabled={busy || note.trim().length < 4}
          onClick={() => void decide("reject")}
          className="rounded-xl border border-line px-3 py-2 text-sm font-semibold disabled:opacity-40"
        >
          Reject
        </button>
      </div>
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
