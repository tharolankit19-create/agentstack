"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";

/**
 * The bar above everything.
 *
 * Every line it rotates through is a fact the product can prove: how many
 * agents exist, how many tools are on the board, what the board adds up to,
 * and what the price is today. There is deliberately no "4 people signed up in
 * the last hour" — invented activity is the single fastest way to lose a
 * technical audience, and this one checks things.
 *
 * The urgency is real urgency: the price is genuinely lower during the beta
 * and genuinely goes up after it. That is a promise the founder has to keep,
 * which is what makes it worth saying.
 */

export function AnnounceBar({
  agentCount,
  toolCount,
  boardTotalUsd,
  priceUsd,
}: {
  agentCount: number;
  toolCount: number;
  boardTotalUsd: number;
  priceUsd: number;
}) {
  const [dismissed, setDismissed] = useState(true);
  const [index, setIndex] = useState(0);

  // Starts hidden and appears on mount, so a visitor who closed it yesterday
  // never sees it flash before the script gets a chance to hide it again.
  useEffect(() => {
    try {
      setDismissed(localStorage.getItem("agentstack-announce") === "closed");
    } catch {
      setDismissed(false);
    }
  }, []);

  const lines = [
    <>
      <span className="text-money">Beta price.</span> ${priceUsd}/mo now, and it
      goes up when the beta ends — whatever you sign up at is what you keep
      paying.
    </>,
    <>
      <span className="text-money">{agentCount} agents</span> running on a
      schedule. Every one replaces a subscription somebody is still paying for.
    </>,
    <>
      <span className="text-money">{toolCount} tools</span> on the board,
      totalling{" "}
      <span className="tnum">${boardTotalUsd.toLocaleString("en-US")}/mo</span> of
      software.
    </>,
  ];

  useEffect(() => {
    if (dismissed) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % lines.length), 6000);
    return () => clearInterval(timer);
  }, [dismissed, lines.length]);

  if (dismissed) return null;

  function close() {
    setDismissed(true);
    try {
      localStorage.setItem("agentstack-announce", "closed");
    } catch {
      // Private browsing. It comes back next time, which is acceptable.
    }
  }

  return (
    <div className="relative z-[60] border-b border-line bg-surface-2">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-5 py-2">
        <span className="pulse-dot" aria-hidden />

        {/* aria-live so the rotation is announced once rather than read as a
            page change on every tick. */}
        <p
          aria-live="polite"
          className="min-w-0 flex-1 truncate text-center text-[13px] text-muted"
        >
          {lines[index]}
        </p>

        <Link
          href="/login?mode=signup"
          className="hidden shrink-0 font-mono text-[11px] uppercase tracking-wider text-fg underline-offset-4 hover:underline sm:block"
        >
          Start free
        </Link>

        <button
          type="button"
          onClick={close}
          aria-label="Dismiss announcement"
          className="shrink-0 text-faint transition-colors hover:text-fg"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
