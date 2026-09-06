"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Undo2 } from "lucide-react";

/**
 * Approve a draft without leaving the board.
 *
 * Two things were wrong and this fixes both. There was no way to approve in the
 * product at all — only by replying to a Telegram message — and the card that
 * said "needs your approval" navigated to the agent's API-key form.
 *
 * It answers instantly whether or not the server has. The row is marked the
 * moment it is clicked and only rolls back if the request actually fails,
 * because a button that waits ~400ms on a round trip before acknowledging a
 * press is the difference between an app that feels quick and one that feels
 * broken, and the founder is approving a queue of these in a row.
 *
 * `router.refresh()` runs inside a transition afterwards, so the board's
 * numbers catch up in the background without the row flickering back to its
 * old state while the server re-renders.
 */
export function ApproveButton({
  generationId,
  onDone,
  size = "md",
}: {
  generationId: string;
  /** Lets the parent drop the row out of its lane immediately. */
  onDone?: () => void;
  size?: "sm" | "md";
}) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function approve(event: React.MouseEvent) {
    // The card behind this is a link. Without both of these, approving also
    // navigates — which is the original bug wearing a different hat.
    event.preventDefault();
    event.stopPropagation();

    if (state !== "idle") return;

    setState("done");
    setError(null);
    onDone?.();

    try {
      const response = await fetch(`/api/generations/${generationId}/approve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ approved: true }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "Could not approve that.");
      }

      startTransition(() => router.refresh());
    } catch (cause) {
      // Only now does it go back — an optimistic update that rolls back on a
      // slow network rather than a real failure is worse than no optimism.
      setState("idle");
      setError(cause instanceof Error ? cause.message : "Could not approve that.");
    }
  }

  const small = size === "sm";

  if (state === "done") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 font-semibold text-money ${
          small ? "text-[11.5px]" : "text-[12.5px]"
        }`}
      >
        <Check className={small ? "size-3" : "size-3.5"} aria-hidden />
        Approved
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={approve}
        disabled={state === "sending"}
        className={`inline-flex items-center gap-1.5 rounded-[var(--r-control)] border border-money/50 bg-money/10 font-semibold text-money transition-all hover:bg-money/20 active:translate-y-px disabled:opacity-60 ${
          small ? "px-2 py-1 text-[11.5px]" : "px-2.5 py-1.5 text-[12.5px]"
        }`}
      >
        {state === "sending" ? (
          <Loader2 className={`animate-spin ${small ? "size-3" : "size-3.5"}`} aria-hidden />
        ) : (
          <Check className={small ? "size-3" : "size-3.5"} aria-hidden />
        )}
        Approve
      </button>
      {error ? (
        <span className="inline-flex items-center gap-1 text-[11.5px] text-danger">
          <Undo2 className="size-3" aria-hidden />
          {error}
        </span>
      ) : null}
    </span>
  );
}
