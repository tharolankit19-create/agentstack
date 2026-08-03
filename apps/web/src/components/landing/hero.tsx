import { Calculator } from "./calculator";
import { SignupButton } from "./signup-button";
import { Reveal } from "@/components/ui/reveal";
import { TEMPLATES, TOTAL_MONTHLY_REPLACED, formatUsd } from "@/lib/templates";

/**
 * 80% of visitors never scroll past this.
 *
 * So the hero does all of it: what this is, why it matters, proof they compute
 * themselves, and the ask. The ask is soft on purpose — signing up and seeing
 * your whole stack costs nothing, and the wall only arrives when you switch an
 * agent on. "Free to look" is true, so it is the strongest thing we can say.
 *
 * The subhead answers the objection people now arrive with, because they now
 * arrive with it: they have just been told they can prompt their way out of a
 * subscription. That is true, and it is not the hard part. Owning the result
 * afterwards is the hard part, and that is the thing being sold here.
 */
export function Hero() {
  return (
    <section className="grid-field relative overflow-hidden border-b border-line px-5 py-14 sm:py-20">
      {/* One coloured wash, top right. The only decoration above the fold. */}
      <div aria-hidden className="aurora -right-40 -top-40 size-[34rem] bg-accent" />

      <div className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
        <div>
          <Reveal>
            <p className="badge-live">
              <span className="pulse-dot" aria-hidden />
              {TEMPLATES.length} agents live · {formatUsd(TOTAL_MONTHLY_REPLACED)}/mo
              replaced
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
              Yes, you could prompt your way to a copy of the tool. Then it is
              yours — the keys, the cron that stopped, the API that changed, the
              4am fix. AgentStack skips all of that: pick the job, click deploy,
              and an agent is doing it on its own URL ninety seconds later.
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
              <li>
                <span className="text-live">✓</span> See all {TEMPLATES.length} agents
                free
              </li>
              <li>
                <span className="text-live">✓</span> $29/mo when you turn one on
              </li>
              <li>
                <span className="text-live">✓</span> Cancel in one click
              </li>
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
