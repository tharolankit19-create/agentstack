import Link from "next/link";
import { ArrowRight, Check, Paperclip } from "lucide-react";
import { AgentAvatar } from "@/components/ui/agent-avatar";

const OUTPUTS = [
  { name: "Ida", seed: "research-agent", title: "14 buyer complaints grouped", meta: "7 sources attached" },
  { name: "Rook", seed: "lead-agent", title: "18 matching founders verified", meta: "41 checked" },
  { name: "Nell", seed: "landing-agent", title: "Pricing-page rewrite ready", meta: "needs approval" },
] as const;

export function Hero() {
  return (
    <section className="hero-screen border-b border-line px-4 pb-7 pt-24 sm:px-6 sm:pb-9 sm:pt-28">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center text-center">
        <p className="text-sm font-semibold text-muted">For founders still doing all the marketing</p>
        <h1 className="mt-4 max-w-5xl text-[44px] font-bold leading-[.94] tracking-[-.06em] text-fg-strong sm:text-[64px] lg:text-[80px] xl:text-[88px]">
          Wake up to finished <span className="text-accent">marketing work.</span>
        </h1>
        <p className="mt-5 max-w-2xl text-[16px] leading-7 text-muted sm:text-[18px]">
          Give Kryx one goal. It researches the market, finds leads, prepares the work and asks for your approval.
        </p>
        <Link href="/login?mode=signup" className="kryx-button kryx-button-primary mt-6 h-12 px-5 text-sm">
          Give Kryx a mission <ArrowRight className="size-4" />
        </Link>
        <p className="mt-3 text-xs text-faint">100 credits included · top up from $5 · no subscription</p>

        <div className="mt-7 w-full max-w-5xl overflow-hidden rounded-2xl border border-line bg-surface text-left shadow-[var(--shadow)] sm:mt-9">
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <AgentAvatar name="Kryx" seed="head-agent" commander size={30} />
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-muted">Mission</p>
                <p className="truncate text-sm font-bold text-fg-strong">Find the next 20 customers and fix what stops them buying.</p>
              </div>
            </div>
            <span className="hidden shrink-0 items-center gap-1.5 text-xs font-semibold text-accent sm:inline-flex"><span className="size-1.5 rounded-full bg-accent" /> Sample workspace</span>
          </div>

          <div className="grid sm:grid-cols-[180px_1fr]">
            <div className="border-b border-line bg-surface-2 px-4 py-4 sm:border-b-0 sm:border-r sm:px-5">
              <p className="text-xs font-semibold text-muted">Since 06:48</p>
              <p className="mt-2 text-3xl font-bold tracking-[-.04em] text-fg-strong">3 outputs</p>
              <p className="mt-1 text-xs leading-5 text-muted">2 ready · 1 needs you</p>
            </div>
            <div className="divide-y divide-line">
              {OUTPUTS.map((output) => (
                <div key={output.name} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
                  <AgentAvatar name={output.name} seed={output.seed} size={28} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-fg-strong">{output.title}</p>
                    <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted"><Paperclip className="size-3" /> {output.meta}</p>
                  </div>
                  <Check className="size-4 shrink-0 text-accent" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
