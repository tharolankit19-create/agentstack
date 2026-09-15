import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { AgentAvatar } from "@/components/ui/agent-avatar";

const SPECIALISTS = [
  ["Ida", "research-agent", "Research", "3 sources checked"],
  ["Rook", "lead-agent", "Leads", "5 qualified"],
  ["Dex", "outreach-agent", "Outreach", "Draft ready"],
] as const;

export function Hero() {
  return (
    <section className="kryx-hero relative overflow-hidden border-b border-line px-4 pt-20 sm:px-5 sm:pt-24">
      <div className="kryx-signal-halo" aria-hidden />
      <div className="kryx-hero-inner relative mx-auto flex min-h-[calc(100svh-5rem)] w-full max-w-6xl flex-col items-center justify-center pb-8 pt-5 text-center sm:pb-10 lg:pb-8 lg:pt-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-accent-line bg-accent-wash px-3 py-1.5 text-[11px] font-extrabold tracking-[.01em] text-accent">
          <span className="size-1.5 rounded-full bg-accent" />
          100 starter credits · no card
        </div>

        <h1 className="mx-auto mt-5 max-w-5xl text-[46px] font-extrabold leading-[.94] tracking-[-.064em] text-fg-strong sm:text-[66px] lg:text-[78px] xl:text-[84px]">
          One goal. Eight agents.
          <span className="block">Marketing work comes back done.</span>
        </h1>

        <p className="mx-auto mt-5 max-w-2xl text-[16px] leading-7 text-muted sm:text-[18px] sm:leading-8">
          Tell Kryx the outcome. It routes research, SEO, content, leads and
          outreach to named specialists, keeps the evidence attached, and asks
          you only when a real decision needs approval.
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
          <span>8 named agents</span>
          <span aria-hidden>·</span>
          <span>Nothing sends without approval</span>
          <span aria-hidden>·</span>
          <span>Top up from $5</span>
        </div>

        <div className="relative mt-7 w-full max-w-[880px] text-left sm:mt-8">
          <div className="overflow-hidden rounded-[24px] border border-line-strong bg-surface shadow-[0_30px_90px_-54px_rgba(5,8,14,.52)]">
            <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 sm:px-5">
              <AgentAvatar name="Kryx" seed="head-agent" size={42} commander animated />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-[.14em] text-faint">
                  Mission
                </p>
                <p className="mt-0.5 text-[14px] font-extrabold text-fg-strong sm:text-[15px]">
                  Find SaaS founders worth talking to this week.
                </p>
              </div>
              <span className="rounded-full border border-accent-line bg-accent-wash px-2.5 py-1 text-[11px] font-extrabold text-accent">
                Kryx routing
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
                  <div className="shrink-0 text-right">
                    <CheckCircle2 className="ml-auto size-4 text-accent" />
                    <p className="mt-1 text-[10px] font-semibold text-faint">{result}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 border-t border-line bg-fg-strong px-4 py-3 text-center text-bg sm:px-5">
              <p className="text-xs font-semibold">3 sources attached.</p>
              <p className="text-xs font-extrabold">1 decision waiting on you.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
