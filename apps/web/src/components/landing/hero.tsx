import Link from "next/link";
import { ArrowRight, Check, Search, Sparkles, TrendingUp } from "lucide-react";

const TASKS = [
  [Search, "Market", "3 competitor moves found"],
  [Sparkles, "Search", "2 SEO pages drafted"],
  [TrendingUp, "Growth", "Signup leak diagnosed"],
] as const;

export function Hero() {
  return (
    <section className="kryx-hero relative overflow-hidden px-5 pb-16 pt-28 sm:pb-20 sm:pt-32">
      <div className="kryx-aurora" aria-hidden />
      <div className="relative mx-auto max-w-6xl">
        <div className="mx-auto max-w-3xl text-center">
          <div className="kryx-badge mx-auto w-fit">
            <span className="size-1.5 rounded-full bg-live shadow-[0_0_14px_var(--live)]" />
            $0/month · 100 credits included
          </div>

          <h1 className="mx-auto mt-6 max-w-4xl text-[44px] font-bold leading-[.96] tracking-[-.055em] text-fg-strong sm:text-[62px] lg:text-[76px]">
            Your AI Head of Marketing.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-[16px] leading-7 text-muted sm:text-[18px]">
            Give Kryx the goal once. It researches, coordinates specialist agents, watches growth, and brings back the few actions that actually need you.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/login?mode=signup" className="kryx-button kryx-button-primary h-12 min-w-[190px] px-5 text-[14px]">
              Hire Kryx free
              <ArrowRight className="size-4" />
            </Link>
            <Link href="#agents" className="kryx-button kryx-button-secondary h-12 min-w-[150px] px-5 text-[14px]">
              See how it works
            </Link>
          </div>

          <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-[12px] font-medium text-muted">
            <span>No card</span><span>•</span><span>No seat fee</span><span>•</span><span>Credits never expire</span>
          </div>
        </div>

        <div className="kryx-product-frame mx-auto mt-11 max-w-5xl">
          <div className="kryx-product-window">
            <div className="flex items-center justify-between border-b border-line px-4 py-3 sm:px-5">
              <div className="flex items-center gap-2.5">
                <span className="grid size-8 place-items-center rounded-xl bg-fg-strong text-bg"><Sparkles className="size-4" /></span>
                <div><p className="text-[13px] font-bold text-fg-strong">Kryx</p><p className="text-[11px] text-muted">Head of Marketing</p></div>
              </div>
              <span className="kryx-live-pill"><span className="size-1.5 rounded-full bg-live" />working</span>
            </div>

            <div className="grid md:grid-cols-[1.12fr_.88fr]">
              <div className="p-4 sm:p-6">
                <div className="ml-auto max-w-lg rounded-[18px] rounded-br-md bg-fg-strong px-4 py-3 text-[13px] leading-6 text-bg">
                  Find why signup conversion dropped, check competitor changes, and prepare the two best SEO pages. Don&apos;t publish without me.
                </div>
                <p className="mt-4 text-[10px] font-bold uppercase tracking-[.14em] text-faint">Kryx delegated 3 jobs</p>
                <div className="mt-2.5 space-y-2">
                  {TASKS.map(([Icon, name, result]) => (
                    <div key={name} className="kryx-task-row">
                      <span className="kryx-task-icon"><Icon className="size-3.5" /></span>
                      <div className="min-w-0 flex-1"><p className="text-[12px] font-bold text-fg-strong">{name}</p><p className="text-[11px] text-muted">{result}</p></div>
                      <Check className="size-3.5 text-live" />
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-line bg-black/[.018] p-4 sm:p-6 md:border-l md:border-t-0 dark:bg-white/[.02]">
                <p className="text-[10px] font-bold uppercase tracking-[.14em] text-faint">Kryx&apos;s brief</p>
                <div className="mt-3 rounded-[18px] border border-accent-line bg-accent-wash p-4">
                  <p className="text-[13px] font-bold leading-5 text-fg-strong">Pricing-page drop-off is the biggest leak.</p>
                  <p className="mt-1.5 text-[12px] leading-5 text-muted">I found one competitor shift and two search opportunities. Nothing has been published.</p>
                  <button className="mt-3 h-9 rounded-xl bg-fg-strong px-3.5 text-[11px] font-bold text-bg">Review 3 actions</button>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Metric value="3" label="done" />
                  <Metric value="2" label="need you" />
                  <Metric value="$0" label="monthly" />
                  <Metric value="100" label="free credits" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return <div className="rounded-[14px] border border-line bg-surface/70 p-3"><p className="text-[18px] font-bold tracking-[-.02em] text-fg-strong">{value}</p><p className="mt-0.5 text-[10px] text-muted">{label}</p></div>;
}
