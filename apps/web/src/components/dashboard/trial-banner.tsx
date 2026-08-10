"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Clock, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TrialState } from "@/lib/trial";

/**
 * The clock on an instant-access hour.
 *
 * Two states, and the honest one is the second. While it runs, this is a
 * countdown that does not nag. When it has run out, it says so plainly and the
 * only way forward is to subscribe — because that is genuinely what has
 * happened, and a banner that softens it just makes the paywall a surprise
 * five clicks later.
 *
 * It refreshes the page once as the clock hits zero, so the server re-renders
 * with the paywall in place rather than leaving a stale dashboard that looks
 * like it still works.
 */
export function TrialBanner({ state }: { state: TrialState }) {
  const router = useRouter();
  const [msLeft, setMsLeft] = useState(state.msRemaining);
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    if (!state.active) return;

    const tick = setInterval(() => {
      const next = new Date(state.endsAt ?? 0).getTime() - Date.now();
      setMsLeft(Math.max(next, 0));

      if (next <= 0 && !flipped) {
        setFlipped(true);
        // One refresh, not a loop: the server decides what happens next.
        router.refresh();
      }
    }, 1000);

    return () => clearInterval(tick);
  }, [state.active, state.endsAt, flipped, router]);

  if (state.expired || (state.active && msLeft <= 0)) {
    return (
      <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-money/40 bg-[var(--money-wash)] p-5">
        <Lock className="size-5 shrink-0 text-money" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-bold text-fg-strong">Your free hour is over.</p>
          <p className="mt-0.5 text-sm text-muted">
            Everything you built is still here and your agents are paused, not
            deleted. Subscribe and they start again on the next run.
          </p>
        </div>
        <Link href="/pricing" className="shrink-0">
          <Button size="sm">Keep my agents running</Button>
        </Link>
      </div>
    );
  }

  if (!state.active) return null;

  const totalSeconds = Math.floor(msLeft / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const urgent = totalSeconds < 600;

  return (
    <div
      className={`flex flex-wrap items-center gap-4 rounded-2xl border p-5 ${
        urgent ? "border-money/40 bg-[var(--money-wash)]" : "border-accent/30 bg-accent/[0.07]"
      }`}
    >
      <Clock
        className={`size-5 shrink-0 ${urgent ? "text-money" : "text-accent"}`}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className="font-bold text-fg-strong">
          Full access, no card &mdash;{" "}
          <span className="tabular-nums">
            {minutes}:{String(seconds).padStart(2, "0")}
          </span>{" "}
          left
        </p>
        <p className="mt-0.5 text-sm text-muted">
          Deploy something real in this window. When the clock stops, your
          agents pause until you subscribe &mdash; nothing you made is lost.
        </p>
      </div>
      <Link href="/pricing" className="shrink-0">
        <Button size="sm" variant={urgent ? "primary" : "darkOutline"}>
          Make it permanent
        </Button>
      </Link>
    </div>
  );
}
