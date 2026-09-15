import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { AgentAvatar } from "@/components/ui/agent-avatar";

const SPECIALISTS = [
  ["Ida", "research-agent", "Researching the market", "Live sources"],
  ["Rook", "lead-agent", "Shortlisting prospects", "Qualified leads"],
  ["Dex", "outreach-agent", "Drafting outreach", "Waiting for approval"],
] as const;

export function Hero() {
  return (
    <section className="kryx-hero border-b border-line px-4 pt-20 sm:px-5 sm:pt-24 lg:flex lg:min-h-[100svh] lg:items-center lg:pt-20">
      <div className="kryx-hero-inner mx-auto grid w-full max-w-7xl gap-8 pb-10 pt-4 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-12 lg:pb-12 lg:pt-8">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-accent-line bg-accent-wash px-3 py-1.5 text-[11px] font-bold tracking-[.02em] text-accent">
            <span className="size-1.5 rounded-full bg-accent" />
            8 agents · 100 starter credits
          </div>

          <h1 className="mt-5 text-[46px] font-extrabold leading-[.93] tracking-[-.065em] text-fg-strong sm:text-[64px] lg:text-[74px] xl:text-[82px]">
            Give Kryx one goal.
            <span className="block text-accent">Eight agents get it done.</span>
          </h1>

          <p className="mt-5 max-w-xl text-[16px] leading-7 text-muted sm:text-[18px] sm:leading-8">
            Research, SEO, content, conversion and pipeline work move in parallel. Kryx keeps the evidence attached and stops before anything consequential leaves your workspace.
          </p>

          <div className="mt-7">
            <Link
              href="/login?mode=signup"
              className="kryx-button kryx-button-primary h-12 px-5 text-sm"
            >
              Run my first mission <ArrowRight className="size-4" />
            </Link>
          </div>

          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold text-faint">
            <span>100 starter credits</span>
            <span aria-hidden>·</span>
            <span>No card</span>
            <span aria-hidden>·</span>
            <span>Top up from $5</span>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-[680px]">
          <div className="overflow-hidden rounded-[24px] border border-line-strong bg-surface shadow-[0_28px_90px_-52px_rgba(8,12,20,.45)]">
            <div className="flex items-center justify-between gap-4 border-b border-line px-4 py-3.5 sm:px-5">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[.12em] text-faint">
                  Example mission
                </p>
                <p className="mt-1 text-[14px] font-bold leading-snug text-fg-strong sm:text-[15px]">
                  Find SaaS founders worth talking to this week.
                </p>
              </div>
              <span className="hidden rounded-full border border-accent-line bg-accent-wash px-2.5 py-1 text-[11px] font-bold text-accent sm:inline-flex">
                Kryx coordinating
              </span>
            </div>

            <div className="border-b border-line bg-surface-2/70 px-4 py-3 sm:px-5">
              <div className="flex items-center gap-3">
                <AgentAvatar name="Kryx" seed="head-agent" size={46} commander animated />
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-fg-strong">Kryx</p>
                  <p className="text-xs text-muted">Breaking the goal into specialist work.</p>
                </div>
                <span className="ml-auto hidden text-[11px] font-semibold text-accent sm:block">
                  Head of marketing
                </span>
              </div>
            </div>

            <div className="divide-y divide-line">
              {SPECIALISTS.map(([name, seed, task, result]) => (
                <div key={name} className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
                  <AgentAvatar name={name} seed={seed} size={40} animated />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-extrabold text-fg-strong">{name}</p>
                    <p className="truncate text-xs text-muted">{task}</p>
                  </div>
                  <span className="hidden items-center gap-1.5 text-[11px] font-semibold text-fg sm:inline-flex">
                    <CheckCircle2 className="size-3.5 text-accent" />
                    {result}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-fg-strong px-4 py-3 text-bg sm:px-5">
              <p className="text-xs font-semibold">Evidence stays attached to the work.</p>
              <p className="text-xs font-extrabold">Nothing sends until you approve.</p>
            </div>
          </div>

          <div className="pointer-events-none absolute -bottom-3 -left-3 -z-10 h-24 w-24 rounded-[24px] bg-accent-wash blur-2xl" />
        </div>
      </div>
    </section>
  );
}
