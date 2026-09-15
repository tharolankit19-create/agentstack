import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AgentAvatar } from "@/components/ui/agent-avatar";

const LIVE = [
  ["Ida", "research-agent", "Researching"],
  ["Rook", "lead-agent", "Qualifying leads"],
  ["Dex", "outreach-agent", "Draft ready"],
] as const;

export function Hero() {
  return (
    <section className="kryx-hero relative overflow-hidden border-b border-line px-4 pt-20 sm:px-5 sm:pt-24">
      <div className="kryx-signal-halo" aria-hidden />
      <div className="relative mx-auto flex min-h-[68svh] w-full max-w-[1500px] items-center justify-center py-10 sm:min-h-[72svh] sm:py-14 lg:py-16">
        <div className="relative z-10 mx-auto w-full max-w-4xl text-center">
          <h1 className="mx-auto text-[50px] font-extrabold leading-[.94] tracking-[-.065em] text-fg-strong sm:text-[70px] lg:text-[84px]">
            Kryx.
            <span className="block">Your AI head of marketing.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-[16px] leading-7 text-muted sm:text-[18px] sm:leading-8">
            Give Kryx the goal. Research, SEO, content, leads and outreach go to
            the right specialist. You only step in when something needs approval.
          </p>

          <Link
            href="/login?mode=signup"
            className="kryx-button kryx-button-primary mt-8 h-14 px-9 text-[15px] sm:h-[58px] sm:px-10 sm:text-base"
          >
            Give Kryx a goal <ArrowRight className="size-[18px]" />
          </Link>

          <p className="mt-5 text-xs font-semibold text-faint sm:text-sm">
            100 starter credits · no card · top up from $5
          </p>
        </div>

        <aside className="absolute right-0 top-1/2 hidden w-[220px] -translate-y-1/2 xl:block 2xl:right-4">
          <div className="rounded-[22px] border border-line bg-surface/92 p-3 shadow-[var(--shadow)] backdrop-blur">
            <div className="flex items-center justify-between px-1 pb-2">
              <p className="text-[11px] font-extrabold uppercase tracking-[.14em] text-faint">
                Team live
              </p>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-live">
                <span className="size-1.5 rounded-full bg-live" /> 8 agents
              </span>
            </div>
            <div className="space-y-2">
              {LIVE.map(([name, seed, status]) => (
                <div key={name} className="flex items-center gap-2.5 rounded-2xl border border-line bg-surface-2/80 p-2.5">
                  <AgentAvatar name={name} seed={seed} size={34} />
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold text-fg-strong">{name}</p>
                    <p className="truncate text-[11px] text-muted">{status}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="px-1 pt-2 text-[10px] leading-4 text-faint">
              Named specialists. One approval queue.
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}
