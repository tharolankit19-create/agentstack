import { Calculator } from "./calculator";
import { SignupButton } from "./signup-button";
import { Reveal } from "@/components/ui/reveal";
import { TEMPLATES, TOTAL_MONTHLY_REPLACED, formatUsd } from "@/lib/templates";

/**
 * 80% of visitors never scroll past this.
 *
 * So the hero does all of it: what this is, why it matters, proof they compute
 * themselves, and the ask. The ask is soft on purpose now — signing up and
 * seeing your whole stack costs nothing, and the wall only arrives when you
 * switch an agent on. "Free to look" is true, so it is the strongest thing we
 * can say.
 */
export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-line px-5 py-14 sm:py-20">
      {/* One violet wash, top right. The only decoration above the fold. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 -top-40 size-[34rem] rounded-full bg-accent opacity-[0.07] blur-[120px]"
      />

      <div className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
        <div>
          <Reveal>
            <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-semibold text-muted">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-70" />
                <span className="relative inline-flex size-1.5 rounded-full bg-accent" />
              </span>
              {TEMPLATES.length} agents live · {formatUsd(TOTAL_MONTHLY_REPLACED)}/mo of
              software replaced
            </p>
          </Reveal>

          <Reveal delay={60}>
            <h1 className="mt-5 text-[40px] font-extrabold leading-[1.03] sm:text-[68px]">
              Cancel your SaaS.
              <br />
              <span className="text-accent">Keep the work.</span>
            </h1>
          </Reveal>

          <Reveal delay={120}>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted sm:text-xl">
              You are renting {TEMPLATES.length} dashboards to do{" "}
              {TEMPLATES.length} jobs, and you open three of them. AgentStack
              gives you an agent for each job instead — already built, already
              knows what to do, live on its own URL in 90 seconds.
            </p>
          </Reveal>

          <Reveal delay={180}>
            <div className="mt-8">
              <SignupButton>Show me my stack — free</SignupButton>
              <p className="mt-3 text-sm font-medium text-muted">
                No card. You only pay when you switch an agent on.
              </p>
            </div>
          </Reveal>

          <Reveal delay={240}>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
              <li>✓ See all {TEMPLATES.length} agents free</li>
              <li>✓ $29/mo when you turn one on</li>
              <li>✓ Cancel in one click</li>
            </ul>
          </Reveal>
        </div>

        <Reveal delay={140} y={20}>
          <Calculator />
        </Reveal>
      </div>
    </section>
  );
}
