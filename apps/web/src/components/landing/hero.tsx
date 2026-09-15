import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { AgentAvatar } from "@/components/ui/agent-avatar";

const WORK = [
  ["research-agent", "Ida", "Competitor move found", "Evidence saved"],
  ["seo-agent", "Wren", "Search gap isolated", "Fix ready"],
  ["lead-agent", "Rook", "5 qualified founders", "List ready"],
] as const;

export function Hero() {
  return (
    <section className="relative flex min-h-[100svh] items-center overflow-hidden border-b border-line px-5 pb-8 pt-24 sm:pt-28">
      <div className="pointer-events-none absolute left-1/2 top-[-13rem] h-[28rem] w-[46rem] -translate-x-1/2 rounded-full bg-accent-wash blur-3xl" />

      <div className="relative mx-auto grid w-full max-w-6xl gap-9 lg:grid-cols-[.9fr_1.1fr] lg:items-center">
        <div className="max-w-2xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-muted">
            <span className="size-1.5 rounded-full bg-live" />
            8 agents · 100 free credits · $0/month
          </div>

          <h1 className="text-[46px] font-extrabold leading-[.94] tracking-[-.055em] text-fg-strong sm:text-[66px] lg:text-[74px]">
            Give Kryx the goal.
            <span className="block text-accent">Get the work back.</span>
          </h1>

          <p className="mt-6 max-w-xl text-[17px] leading-7 text-muted sm:text-[19px] sm:leading-8">
            Kryx coordinates research, SEO, content, conversion and pipeline work.
            You see the evidence, the finished output and the few decisions that still need you.
          </p>

          <div className="mt-8">
            <Link href="/login?mode=signup" className="kryx-button kryx-button-primary h-12 px-5 text-sm">
              Give Kryx a goal <ArrowRight className="size-4" />
            </Link>
          </div>

          <p className="mt-4 text-[13px] text-muted">
            No card · one-time credit top-ups · approval stays with you
          </p>
        </div>

        <div className="overflow-hidden rounded-[24px] border border-line bg-surface shadow-[0_30px_80px_-50px_rgba(24,31,56,.55)]">
          <div className="flex items-center justify-between border-b border-line px-4 py-3 sm:px-5">
            <div className="flex items-center gap-3">
              <AgentAvatar name="Kryx" seed="head-agent" commander size={38} />
              <div>
                <p className="text-sm font-extrabold text-fg-strong">Kryx is working</p>
                <p className="text-[11px] text-muted">Goal: find the next growth move</p>
              </div>
            </div>
            <span className="rounded-full bg-live-wash px-2.5 py-1 text-[11px] font-bold text-live">3 ready</span>
          </div>

          <div className="px-4 py-4 sm:px-5">
            <p className="text-[11px] font-bold uppercase tracking-[.13em] text-faint">Finished since you left</p>
            <div className="mt-3 divide-y divide-line rounded-2xl border border-line bg-surface-2">
              {WORK.map(([seed, name, title, state]) => (
                <div key={name} className="flex items-center gap-3 px-3 py-3">
                  <AgentAvatar name={name} seed={seed} size={34} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold text-fg-strong">{title}</p>
                    <p className="mt-0.5 text-[11px] text-muted">{name} · specialist</p>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-live">
                    <Check className="size-3" /> {state}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              {[["8", "agents"], ["2", "need you"], ["1", "balance"]].map(([value, label]) => (
                <div key={label} className="rounded-xl border border-line bg-bg px-3 py-2.5 text-center">
                  <p className="tnum text-lg font-extrabold text-fg-strong">{value}</p>
                  <p className="text-[10px] text-muted">{label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-line bg-fg-strong px-4 py-3 text-bg sm:px-5">
            <p className="text-xs">2 decisions need your approval</p>
            <span className="text-xs font-bold">Review work →</span>
          </div>
        </div>
      </div>
    </section>
  );
}
