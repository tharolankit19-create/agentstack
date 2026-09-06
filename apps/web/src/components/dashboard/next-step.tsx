"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Loader2, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * The one thing to do next.
 *
 * The dashboard used to present three or four things at once — connect
 * Telegram, configure an agent, deploy an agent, upgrade — and a founder
 * confronted with four calls to action does none of them. Worse, the deploy
 * button lived on each of fourteen cards, so "turn it on" looked like fourteen
 * decisions rather than one.
 *
 * So the whole state machine is reduced to a single card with a single button,
 * in the same place every time, and the dashboard renders exactly one of
 * these. Everything below it is status, not action.
 *
 * Launching batches deliberately. Each deploy uploads a runtime and waits for
 * Vercel; fourteen in one request times out halfway through, which looks
 * identical to a failure while actually having half-worked. Batches give an
 * honest progress bar instead.
 */
export function NextStep({
  total,
  live,
  pending,
  broken,
}: {
  /** Every agent they own. */
  total: number;
  /** Deployed and not paused. */
  live: number;
  /** Not deployed yet — the ones this button is for. */
  pending: number;
  /** Deployed but erroring. */
  broken: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [placed, setPlaced] = useState(0);
  const [left, setLeft] = useState(pending);
  const [error, setError] = useState<string | null>(null);

  async function launch() {
    setBusy(true);
    setError(null);
    setPlaced(0);

    try {
      // Keep asking until the server says there is nothing left. The bound is
      // belt and braces: a server that always reported work remaining would
      // otherwise spin here forever.
      for (let round = 0; round < 12; round += 1) {
        const response = await fetch("/api/army/launch", { method: "POST" });
        const payload = (await response.json()) as {
          deployed: number;
          remaining: number;
          done: boolean;
          failed?: { name: string; reason: string }[];
          error?: string;
        };

        if (!response.ok) throw new Error(payload.error ?? "Could not deploy.");

        setPlaced((current) => current + payload.deployed);
        setLeft(payload.remaining);

        if (payload.failed?.length) {
          // The first failure is the useful one — the rest are usually the
          // same cause repeated, and a wall of identical errors reads as a
          // bigger problem than it is.
          setError(`${payload.failed[0].name}: ${payload.failed[0].reason}`);
          break;
        }

        if (payload.done) break;
      }

      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  // ── Everything is running ─────────────────────────────────────────────────
  if (pending === 0 && broken === 0) {
    return (
      <section className="flex flex-wrap items-center gap-4 rounded-2xl border border-live/40 bg-[var(--live-wash)] px-6 py-5">
        <Check className="size-6 shrink-0 text-live" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-extrabold text-fg-strong">
            All {live} agents are live.
          </p>
          <p className="mt-0.5 text-sm text-muted">
            Nothing left to do. The first briefing arrives at the time you
            picked — you will get it on Telegram, not here.
          </p>
        </div>
      </section>
    );
  }

  // ── Something needs a look ────────────────────────────────────────────────
  if (pending === 0 && broken > 0) {
    return (
      <section className="flex flex-wrap items-center gap-4 rounded-2xl border border-[var(--danger-line)] bg-[var(--danger-wash)] px-6 py-5">
        <AlertTriangle className="size-6 shrink-0 text-danger" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-extrabold text-fg-strong">
            {broken} {broken === 1 ? "agent needs" : "agents need"} a look
          </p>
          <p className="mt-0.5 text-sm text-muted">
            Open it below — the exact error from its last deploy is on its page.
            Usually a missing key.
          </p>
        </div>
      </section>
    );
  }

  // ── One button ────────────────────────────────────────────────────────────
  return (
    <section className="rounded-2xl border-2 border-accent bg-accent/[0.06] px-6 py-5">
      <div className="flex flex-wrap items-center gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-lg font-extrabold text-fg-strong">
            {live > 0
              ? `Turn on the other ${pending}`
              : `Turn on all ${total} agents`}
          </p>
          <p className="mt-0.5 text-sm text-muted">
            One click activates the full roster in the shared runtime. Their
            work and schedules stay together in this workspace.
          </p>
        </div>

        <Button onClick={launch} disabled={busy} size="md" className="shrink-0">
          {busy ? <Loader2 className="animate-spin" /> : <Rocket />}
          {busy ? "Starting…" : "Start my army"}
        </Button>
      </div>

      {busy || placed > 0 ? (
        <div className="mt-4">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
            <div
              className="h-full bg-live transition-all duration-500"
              style={{
                width: `${Math.round((placed / Math.max(pending, 1)) * 100)}%`,
              }}
            />
          </div>
          <p className="mt-2 text-xs text-muted">
            {placed} deployed{left > 0 ? `, ${left} to go` : " — done"}
          </p>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-3 text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </section>
  );
}
