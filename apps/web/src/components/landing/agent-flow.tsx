import { ArrowRight, Check, FileSearch, Globe2, Search, Send, Sparkles, Target, TrendingUp } from "lucide-react";

const specialists = [
  [Search, "Research", "market + competitors"],
  [FileSearch, "SEO", "search opportunities"],
  [TrendingUp, "Growth", "funnel diagnosis"],
  [Target, "Leads", "qualified pipeline"],
  [Send, "Content", "drafts + distribution"],
] as const;

export function AgentFlow() {
  return (
    <section id="agents" className="px-5 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <p className="kryx-kicker">One conversation. Specialist execution.</p>
          <h2 className="mt-3 text-3xl font-bold tracking-[-.045em] sm:text-5xl">Kryx runs the team behind the screen.</h2>
          <p className="mx-auto mt-4 max-w-xl text-[16px] leading-7 text-muted sm:text-[17px]">You tell the head of marketing the outcome. Kryx routes work, combines the receipts, and only pulls you in when a decision matters.</p>
        </div>

        <div className="agent-flow-stage mt-10 sm:mt-12">
          <div className="agent-flow-rail" aria-hidden />

          <div className="agent-flow-head">
            <span className="agent-flow-mark"><Sparkles className="size-4" /></span>
            <div>
              <p className="text-sm font-bold text-fg-strong">Kryx</p>
              <p className="text-[11px] text-muted">AI Head of Marketing</p>
            </div>
          </div>

          <div className="agent-flow-stream" aria-label="Kryx specialist agents">
            {[...specialists, ...specialists].map(([Icon, name, detail], index) => (
              <div className="agent-flow-chip" key={`${name}-${index}`}>
                <span className="agent-flow-icon"><Icon className="size-4" /></span>
                <span><strong>{name}</strong><small>{detail}</small></span>
              </div>
            ))}
          </div>

          <div className="agent-flow-output">
            <div className="flex items-center gap-2 text-[12px] font-semibold text-muted"><Globe2 className="size-4" />Today&apos;s output</div>
            <p className="mt-2 text-[15px] font-bold text-fg-strong">3 actions worth your attention</p>
            <div className="mt-3 space-y-2 text-[12px] text-muted">
              <p className="flex items-center gap-2"><Check className="size-3.5 text-live" />Pricing-page leak diagnosed</p>
              <p className="flex items-center gap-2"><Check className="size-3.5 text-live" />2 SEO drafts prepared</p>
              <p className="flex items-center gap-2"><ArrowRight className="size-3.5 text-accent" />1 publish approval waiting</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
