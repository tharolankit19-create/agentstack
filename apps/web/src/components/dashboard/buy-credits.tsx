"use client";

import { useMemo, useState } from "react";
import { Coins, Loader2, Plus } from "lucide-react";
import { CREDITS_PER_DOLLAR, MIN_TOPUP_USD, PACKS, TOPUP_STEP_USD } from "@/lib/credits-public";

export function BuyCredits({ balance }: { balance: number }) {
  const [amount, setAmount] = useState(5);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const credits = useMemo(() => amount * CREDITS_PER_DOLLAR, [amount]);

  async function buy() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/credits/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amountUsd: amount }),
      });
      const payload = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !payload.url) throw new Error(payload.error ?? "Could not open checkout.");
      window.location.href = payload.url;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not reach checkout.");
      setPending(false);
    }
  }

  function normalize(value: number) {
    const safe = Math.max(MIN_TOPUP_USD, Math.round(value / TOPUP_STEP_USD) * TOPUP_STEP_USD);
    setAmount(safe);
  }

  return (
    <section className="kryx-panel overflow-hidden rounded-[28px] border border-line bg-surface p-6 sm:p-8">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">Kryx credits</p>
          <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-fg-strong">Add only what you need.</h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
            100 credits = $1. No subscription, no expiry, no seat fee. Kryx chat stays free; specialist work uses credits.
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-surface-2 px-4 py-3 text-right">
          <p className="text-xs text-muted">Current balance</p>
          <p className="mt-1 text-xl font-extrabold text-fg-strong">{balance.toLocaleString()} credits</p>
        </div>
      </div>

      <div className="mt-7 flex flex-wrap gap-2">
        {PACKS.map((pack) => (
          <button key={pack.id} type="button" onClick={() => setAmount(pack.priceUsd)} className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${amount === pack.priceUsd ? "border-accent bg-accent text-accent-fg" : "border-line bg-surface-2 text-fg hover:border-line-strong"}`}>
            ${pack.priceUsd}
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <label className="block">
          <span className="text-xs font-semibold text-muted">Top-up amount · minimum ${MIN_TOPUP_USD}</span>
          <div className="mt-2 flex h-14 items-center rounded-2xl border border-line bg-bg px-4 focus-within:border-accent">
            <span className="text-lg font-bold text-muted">$</span>
            <input value={amount} onChange={(e) => normalize(Number(e.target.value || MIN_TOPUP_USD))} inputMode="numeric" min={MIN_TOPUP_USD} step={TOPUP_STEP_USD} className="min-w-0 flex-1 bg-transparent px-2 text-xl font-extrabold text-fg-strong outline-none" />
            <span className="text-sm font-semibold text-muted">= {credits.toLocaleString()} credits</span>
          </div>
        </label>
        <button type="button" onClick={() => void buy()} disabled={pending} className="kryx-primary inline-flex h-14 items-center justify-center gap-2 rounded-2xl px-6 text-sm font-bold disabled:opacity-60">
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          {pending ? "Opening checkout…" : `Add ${credits.toLocaleString()} credits`}
        </button>
      </div>

      <div className="mt-4 flex items-center gap-2 text-xs text-muted">
        <Coins className="size-4 text-accent" /> Purchased credits never expire. Work pauses before balance goes negative.
      </div>
      {error ? <p role="alert" className="mt-3 text-sm font-medium text-danger">{error}</p> : null}
    </section>
  );
}
