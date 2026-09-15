import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { AgentAvatar } from "@/components/ui/agent-avatar";

const SPECIALISTS = [
  ["Ida", "research-agent", "Market research", "Live evidence"],
  ["Rook", "lead-agent", "Lead shortlist", "5 prospects"],
  ["Dex", "outreach-agent", "Outreach draft", "Needs approval"],
] as const;

export function Hero() {
  return (
    <section className="kryx-hero border-b border-line px-4 pt-20 sm:px-5 sm:pt-24 lg:flex lg:min-h-[100svh] lg:items-center lg:pt-20">
      <div className="kryx-hero-inner mx-auto flex w-full max-w-6xl flex-col items-center pb-10 pt-5 text-center lg:pb-10 lg:pt-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-accent-line bg-accent-wash px-3 py-1.5 text-[11px] font-bold tracking-[.02em] text-accent">
          <span className="size-1.5 rounded-full bg-accent" />
          8 agents · 100 starter credits
        </div>

        <h1 className="mx-auto mt-5 max-w-5xl text-[48px] font-extrabold leading-[.93] tracking-[-.065em] text-fg-strong sm:text-[68px] lg:text-[78px] xl:text-[86px]">
          One goal in.
          <span className="block">Eight agents get to work.</span>
        </h1>

        <p className="mx-auto mt-5 max-w-2xl text-[16px] leading-7 text-muted sm:text-[18px] sm:leading-8">
          Kryx coordinates research, SEO, content, conversion and pipeline work,
          keeps the evidence attached, and asks you only when a real decision is needed.
        </p>

        <div className="mt-7 flex justify-center">
          <Link
            href="/login?mode=signup"
            className="kryx-button kryx-button-primary h-12 px-6 text-sm"
          >
            Run my first mission <ArrowRight className="size-4" />
          </Link>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs font-semibold text-faint">
          <span>100 starter credits</span>
          <span aria-hidden>·</span>
          <span>No card</span>
          <span aria-hidden>·</span>
          <span>Top up from $5</span>
        </div>

        <div className="relative mt-8 w-full max-w-[900px] text-left sm:mt-9">
          <div className="overflow-hidden rounded-[24px] border border-line-strong bg-surface shadow-[0_28px_90px_-52px_rgba(8,12,20,.45)]">
            <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 sm:px-5">
              <AgentAvatar name="Kryx" seed="head-agent" size={42} commander animated />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold uppercase tracking-[.12em] text-faint">Mission</p>
                <p className="mt-0.5 text-[14px] font-bold text-fg-strong sm:text-[15px]">
                  Find SaaS founders worth talking to this week.
                </p>
              </div>
              <span className="rounded-full border border-accent-line bg-accent-wash px-2.5 py-1 text-[11px] font-bold text-accent">
                Kryx coordinating
              </span>
            </div>

            <div className="grid divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              {SPECIALISTS.map(([name, seed, task, result]) => (
                <div key={name} className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
                  <AgentAvatar name={name} seed={seed} size={38} animated />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-extrabold text-fg-strong">{name}</p>
                    <p className="truncate text-xs text-muted">{task}</p>
                  </div>
                  <CheckCircle2 className="size-4 shrink-0 text-accent" aria-label={result} />
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 border-t border-line bg-fg-strong px-4 py-3 text-center text-bg sm:px-5">
              <p className="text-xs font-semibold">Evidence attached.</p>
              <p className="text-xs font-extrabold">Nothing sends until you approve.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
