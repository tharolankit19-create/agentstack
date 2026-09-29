"use client";

import { useState } from "react";

export function ApprovalDecision({ id }: { id: string }) {
  const [pending, setPending] = useState<"approve" | "reject" | null>(null);
  const [done, setDone] = useState<"approved" | "rejected" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: "approve" | "reject") {
    if (pending || done) return;
    setPending(decision);
    setError(null);

    const response = await fetch(`/api/action-approvals/${id}/decision`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    const body = (await response.json().catch(() => ({}))) as {
      status?: "approved" | "rejected";
      error?: string;
    };

    if (!response.ok || !body.status) {
      setError(body.error ?? "Could not save that decision.");
      setPending(null);
      return;
    }

    setDone(body.status);
    setPending(null);
  }

  if (done) {
    return (
      <span className="text-[13px] font-semibold text-muted">
        {done === "approved" ? "Approved" : "Rejected"}
      </span>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={Boolean(pending)}
        onClick={() => void decide("approve")}
        className="rounded-lg bg-fg-strong px-3 py-2 text-[13px] font-bold text-bg disabled:opacity-50"
      >
        {pending === "approve" ? "Approving…" : "Approve"}
      </button>
      <button
        type="button"
        disabled={Boolean(pending)}
        onClick={() => void decide("reject")}
        className="rounded-lg border border-line px-3 py-2 text-[13px] font-semibold text-muted hover:border-line-strong hover:text-fg disabled:opacity-50"
      >
        {pending === "reject" ? "Rejecting…" : "Reject"}
      </button>
      {error ? <p className="basis-full text-[12px] text-danger">{error}</p> : null}
    </div>
  );
}
