"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Check, Loader2, ShieldCheck, WalletCards } from "lucide-react";
import { CREDITS_PER_DOLLAR, MIN_TOPUP_USD, PACKS, TOPUP_STEP_USD } from "@/lib/credits-public";

export function BuyCredits({ balance }: { balance: number }) {
  const [amount, setAmount] = useState(5);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const credits = useMemo(() => amount * CREDITS_PER_DOLLAR, [amount]);
  const dollars = balance / CREDITS_PER_DOLLAR;

  async function buy() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/credits/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ amountUsd: amount }) });
      const payload = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !payload.url) throw new Error(payload.error ?? "Could not open checkout.");
      window.location.href = payload.url;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not reach checkout.");
      setPending(false);
    }
  }

  function normalize(value: number) {
    setAmount(Math.max(MIN_TOPUP_USD, Math.round(value / TOPUP_STEP_USD) * TOPUP_STEP_USD));
  }

  return (
    <section className="overflow-hidden rounded-[28px] border border-line bg-surface shadow-[0_24px_80px_-55px_rgba(15,20,35,.5)]">
      <div className="grid gap-0 lg:grid-cols-[.75fr_1.25fr]">
        <div className="border-b border-line bg-fg-strong p-6 text-bg sm:p-8 lg:border-b-0 lg:border-r">
          <p className="text-[11px] font-bold uppercase tracking-[.16em] opacity-60">Work balance</p>
          <p className="mt-3 text-5xl font-black tracking-[-.05em]">${dollars.toFixed(2)}</p>
          <p className="mt-2 text-sm opacity-65">{balance.toLocaleString()} credits available</p>
          <div className="mt-7 space-y-3 text-sm">
            <p className="flex items-center gap-2"><Check className="size-4" /> No subscription</p>
            <p className="flex items-center gap-2"><Check className="size-4" /> Credits never expire</p>
            <p className="flex items-center gap-2"><Check className="size-4" /> Work pauses before balance goes negative</p>
          </div>
        </div>

        <div className="p-6 sm:p-8">
          <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-2xl bg-[#4f6bff]/10 text-[#4f6bff]"><WalletCards className="size-5" /></span><div><h2 className="text-2xl font-extrabold tracking-tight text-fg-strong">Buy work balance</h2><p className="text-sm text-muted">Choose a dollar amount. Kryx handles the credit math.</p></div></div>

          <div className="mt-7 flex flex-wrap gap-2">
            {PACKS.map((pack) => <button key={pack.id} type="button" onClick={() => setAmount(pack.priceUsd)} className={`rounded-full border px-4 py-2 text-sm font-semibold transition-all active:scale-95 ${amount === pack.priceUsd ? "border-fg-strong bg-fg-strong text-bg" : "border-line bg-surface-2 text-fg hover:border-line-strong"}`}>${pack.priceUsd}</button>)}
          </div>

          <label className="mt-5 block"><span className="text-xs font-semibold text-muted">Custom amount · minimum ${MIN_TOPUP_USD}</span><div className="mt-2 flex h-14 items-center rounded-2xl border border-line bg-bg px-4 focus-within:border-fg-strong"><span className="text-lg font-bold text-muted">$</span><input value={amount} onChange={(e) => normalize(Number(e.target.value || MIN_TOPUP_USD))} inputMode="numeric" min={MIN_TOPUP_USD} step={TOPUP_STEP_USD} className="min-w-0 flex-1 bg-transparent px-2 text-xl font-extrabold text-fg-strong outline-none" /><span className="text-xs font-semibold text-muted">≈ {credits.toLocaleString()} credits</span></div></label>

          <button type="button" onClick={() => void buy()} disabled={pending} className="mt-4 inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-fg-strong px-6 text-sm font-bold text-bg transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60">{pending ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}{pending ? "Opening secure checkout…" : `Buy $${amount} of Kryx work`}<ArrowRight className="size-4" /></button>
          <p className="mt-3 text-center text-xs text-muted">100 credits = $1 · one-time payment · no auto-renewal</p>
          {error ? <p role="alert" className="mt-3 text-sm font-medium text-danger">{error}</p> : null}
        </div>
      </div>
    </section>
  );
}
