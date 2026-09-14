import Link from "next/link";
import { ArrowRight, Check, Search, Sparkles, TrendingUp } from "lucide-react";

const TASKS = [
  [Search, "Research", "3 competitor moves found"],
  [Sparkles, "SEO", "2 pages ready for approval"],
  [TrendingUp, "Growth", "Signup drop-off spotted"],
] as const;

export function Hero() {
  return (
    <section className="kryx-hero relative overflow-hidden px-5 pb-24 pt-24 sm:pb-32 sm:pt-32">
      <div className="kryx-aurora" aria-hidden />
      <div className="relative mx-auto max-w-6xl text-center">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/70 px-4 py-2 text-xs font-bold tracking-wide text-black shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-black/30 dark:text-white">
          <span className="size-2 rounded-full bg-[#35d6a6] shadow-[0_0_16px_#35d6a6]" />
          $0/month · $1 of work free
        </div>

        <h1 className="mx-auto mt-7 max-w-5xl text-[56px] font-extrabold leading-[0.93] tracking-[-0.065em] text-fg-strong sm:text-[84px] lg:text-[104px]">
          Your AI Head of Marketing.
        </h1>
        <p className="mx-auto mt-7 max-w-2xl text-[18px] leading-relaxed text-muted sm:text-[21px]">
          Tell Kryx what you want. It researches, delegates to specialist agents, watches your growth, and brings back finished work — while you keep the final say.
        </p>

        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/login?mode=signup" className="kryx-primary group inline-flex h-14 min-w-[220px] items-center justify-center gap-2 rounded-2xl px-7 text-[16px] font-bold">
            Hire Kryx for free
            <ArrowRight className="size-5 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link href="/demo" className="inline-flex h-14 min-w-[180px] items-center justify-center rounded-2xl border border-line bg-surface/75 px-6 text-[15px] font-semibold text-fg-strong shadow-sm backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-line-strong">
            Watch it work
          </Link>
        </div>

        <div className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-muted">
          <span>No card</span><span>100 free credits</span><span>No seat fee</span><span>Credits never expire</span>
        </div>

        <div className="mx-auto mt-14 max-w-5xl rounded-[32px] border border-white/60 bg-white/65 p-3 shadow-[0_35px_100px_-35px_rgba(19,25,43,.35)] backdrop-blur-2xl dark:border-white/10 dark:bg-black/35">
          <div className="overflow-hidden rounded-[24px] border border-black/10 bg-[#fbfbfd] text-left dark:border-white/10 dark:bg-[#0b0b0e]">
            <div className="flex items-center justify-between border-b border-black/8 px-5 py-4 dark:border-white/10">
              <div>
                <p className="text-sm font-extrabold text-fg-strong">Kryx · Head of Marketing</p>
                <p className="mt-0.5 text-xs text-muted">Working across research, SEO, conversion and pipeline</p>
              </div>
              <span className="rounded-full bg-[#35d6a6]/15 px-3 py-1 text-xs font-bold text-[#07966f]">Working</span>
            </div>

            <div className="grid gap-0 md:grid-cols-[1.1fr_.9fr]">
              <div className="p-5 sm:p-7">
                <div className="ml-auto max-w-xl rounded-[22px] rounded-br-md bg-[#101114] px-5 py-4 text-[15px] leading-relaxed text-white">
                  Find why our signup conversion dropped, research what competitors changed this week, and draft the two best SEO pages. Don&apos;t publish without me.
                </div>
                <p className="mt-5 text-xs font-bold uppercase tracking-[.16em] text-muted">Kryx delegated 3 jobs</p>
                <div className="mt-3 space-y-2.5">
                  {TASKS.map(([Icon, name, result]) => (
                    <div key={name} className="flex items-center gap-3 rounded-2xl border border-black/8 bg-white px-4 py-3.5 shadow-sm dark:border-white/10 dark:bg-white/[.04]">
                      <span className="grid size-9 place-items-center rounded-xl bg-[#4f6bff]/10 text-[#4f6bff]"><Icon className="size-4" /></span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-fg-strong">{name}</p>
                        <p className="mt-0.5 text-xs text-muted">{result}</p>
                      </div>
                      <Check className="size-4 text-[#35d6a6]" />
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-black/8 bg-black/[.025] p-5 sm:p-7 md:border-l md:border-t-0 dark:border-white/10 dark:bg-white/[.025]">
                <p className="text-xs font-bold uppercase tracking-[.16em] text-muted">What Kryx tells you</p>
                <div className="mt-4 rounded-[22px] border border-[#4f6bff]/20 bg-[#4f6bff]/8 p-5">
                  <p className="text-[15px] font-bold leading-snug text-fg-strong">Pricing page drop-off is the biggest leak.</p>
                  <p className="mt-2 text-sm leading-relaxed text-muted">I found one competitor shift and two search opportunities. Nothing is published yet.</p>
                  <button className="mt-4 h-10 rounded-xl bg-[#101114] px-4 text-xs font-bold text-white">Review the 3 actions</button>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <Metric value="3" label="jobs done" />
                  <Metric value="2" label="need you" />
                  <Metric value="0" label="monthly fee" prefix="$" />
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

function Metric({ value, label, prefix = "" }: { value: string; label: string; prefix?: string }) {
  return <div className="rounded-2xl border border-black/8 bg-white/70 p-4 dark:border-white/10 dark:bg-white/[.04]"><p className="text-2xl font-extrabold text-fg-strong">{prefix}{value}</p><p className="mt-1 text-xs text-muted">{label}</p></div>;
}
