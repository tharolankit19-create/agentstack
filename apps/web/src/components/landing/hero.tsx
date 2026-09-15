import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { AgentAvatar } from "@/components/ui/agent-avatar";

const WORK = [
  ["Ida", "research-agent", "Market research", "8 sources checked"],
  ["Rook", "lead-agent", "Lead research", "12 qualified"],
  ["Dex", "outreach-agent", "Outreach", "12 drafts waiting"],
] as const;

export function Hero() {
  return (
    <section className="flex min-h-svh items-center border-b border-line px-5 pb-10 pt-24 sm:pt-28">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-accent-line bg-accent-wash px-3 py-1.5 text-[11px] font-bold uppercase tracking-[.12em] text-accent">
            <span className="size-1.5 rounded-full bg-accent" />
            8 agents · $0/month · 100 starter credits
          </div>

          <h1 className="mx-auto mt-6 max-w-[980px] text-[48px] font-extrabold leading-[.94] tracking-[-.06em] text-fg-strong sm:text-[68px] lg:text-[86px]">
            Stop managing AI.
            <span className="block text-accent">Give Kryx the goal.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-[16px] leading-7 text-muted sm:text-[18px] sm:leading-8">
            Kryx coordinates research, SEO, content, conversion and pipeline work, saves the evidence, and brings the finished work back for your approval.
          </p>

          <div className="mt-7">
            <Link
              href="/login?mode=signup"
              className="kryx-button kryx-button-primary h-12 px-6 text-sm"
            >
              Give Kryx a goal <ArrowRight className="size-4" />
            </Link>
          </div>

          <p className="mt-3 text-xs text-faint">
            No card · 100 credits included · purchased credits never expire
          </p>
        </div>

        <div className="mx-auto mt-9 max-w-5xl overflow-hidden rounded-[22px] border border-line-strong bg-surface shadow-[0_30px_100px_-70px_rgba(20,25,40,.55)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.12em] text-faint">Sample mission</p>
              <p className="mt-1 text-sm font-semibold text-fg-strong">
                Find 20 SaaS founders worth talking to this week.
              </p>
            </div>
            <span className="rounded-full border border-accent-line bg-accent-wash px-2.5 py-1 text-[11px] font-bold text-accent">
              Kryx is coordinating
            </span>
          </div>

          <div className="grid md:grid-cols-3">
            {WORK.map(([name, seed, role, result], index) => (
              <div
                key={name}
                className={`flex items-center gap-3 px-4 py-4 sm:px-5 ${index < WORK.length - 1 ? "border-b border-line md:border-b-0 md:border-r" : ""}`}
              >
                <AgentAvatar name={name} seed={seed} size={42} animated />
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-fg-strong">{name}</p>
                  <p className="text-xs text-muted">{role}</p>
                  <p className="mt-1 inline-flex items-center gap-1.5 text-[11px] font-semibold text-fg">
                    <Check className="size-3 text-accent" /> {result}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface-2 px-4 py-3 sm:px-5">
            <p className="text-xs text-muted">
              Evidence saved · nothing sends until you approve
            </p>
            <p className="text-xs font-extrabold text-fg-strong">12 leads ready for review →</p>
          </div>
        </div>
      </div>
    </section>
  );
}
