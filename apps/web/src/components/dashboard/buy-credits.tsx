"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { PACKS, savingPercent, packShape } from "@/lib/credits-public";

/**
 * Buying credit.
 *
 * Three packs, and the button says what it does rather than "Choose plan" —
 * there is no plan to choose, which is the difference this whole model exists
 * to make. The pending state is per pack, not global: a spinner on all three
 * while one opens reads as the page having frozen.
 *
 * Errors are shown next to the button that caused them. A single error line at
 * the top of a page is something a founder scrolls past on their way to
 * clicking the same button again.
 */
export function BuyCredits({ balance }: { balance: number }) {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function buy(pack: string) {
    setPending(pack);
    setError(null);

    try {
      const response = await fetch("/api/credits/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pack }),
      });

      const payload = (await response.json()) as { url?: string; error?: string };

      if (!response.ok || !payload.url) {
        setError(payload.error ?? "Could not open checkout.");
        setPending(null);
        return;
      }

      window.location.href = payload.url;
    } catch {
      setError("Could not reach checkout. Try again in a moment.");
      setPending(null);
    }
  }

  return (
    <section>
      <h2 className="text-xl font-bold text-fg-strong">Add credit</h2>
      <p className="mt-1 text-[14px] text-muted">
        {balance > 0
          ? "Tops up your balance. Nothing expires and there is nothing to cancel."
          : "You are out of credit, so the team has stopped looking things up. Adding some starts it again on the next tick."}
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {PACKS.map((pack) => {
          const saving = savingPercent(pack);
          const busy = pending === pack.id;

          return (
            <div key={pack.id} className="rounded-xl border border-line bg-surface p-5">
              <p className="text-sm font-semibold text-muted">{pack.label}</p>

              <p className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold tracking-[-0.02em] text-fg-strong">
                  ${pack.priceUsd}
                </span>
                {saving > 0 ? (
                  <span className="text-[13px] font-semibold text-accent">−{saving}%</span>
                ) : null}
              </p>

              <p className="mt-1 text-[14px] font-semibold text-fg">
                {pack.credits.toLocaleString("en-US")} credits
              </p>
              <p className="mt-2 text-[13px] leading-snug text-muted">
                Roughly {packShape(pack.credits)}.
              </p>

              <button
                type="button"
                onClick={() => void buy(pack.id)}
                disabled={Boolean(pending)}
                className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-accent text-[15px] font-semibold text-accent-fg transition-transform hover:scale-[1.01] disabled:opacity-60"
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                {busy ? "Opening…" : `Add ${pack.credits.toLocaleString("en-US")}`}
              </button>
            </div>
          );
        })}
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </section>
  );
}
