import { Calculator } from "./calculator";
import { SignupButton } from "./signup-button";
import { Reveal } from "@/components/ui/reveal";
import { TEMPLATES, TOTAL_MONTHLY_REPLACED, formatUsd } from "@/lib/templates";

/**
 * 80% of visitors never scroll past this. So the hero says what this is, why
 * it matters, proves it with a number they compute themselves, and asks.
 */
export function Hero() {
  return (
    <section className="border-b border-[var(--color-line)] px-5 py-14 sm:py-20">
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
        <div>
          <Reveal>
            <p className="inline-flex items-center gap-2 rounded-full border border-[var(--color-line)] px-3 py-1 text-xs font-semibold text-[var(--color-ink-soft)]">
              <span className="size-1.5 rounded-full bg-[var(--color-accent)]" />
              {TEMPLATES.length} agents live · {formatUsd(TOTAL_MONTHLY_REPLACED)}/mo
              of software replaced
            </p>
          </Reveal>

          <Reveal delay={60}>
            <h1 className="mt-5 text-[38px] font-extrabold leading-[1.05] sm:text-6xl">
              Cancel your SaaS.
              <br />
              <span className="text-[var(--color-accent)]">Keep the work.</span>
            </h1>
          </Reveal>

          <Reveal delay={120}>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-[var(--color-ink-soft)] sm:text-xl">
              You are paying twelve companies to do twelve jobs. AgentStack gives
              you an agent for each one — already built, already knows the job.
              Pick it, connect it, it runs. No tool to learn, no seat to buy.
            </p>
          </Reveal>

          <Reveal delay={180}>
            <div className="mt-8">
              <SignupButton>Replace my first 3 tools</SignupButton>
              <p className="mt-3 text-sm text-[var(--color-ink-soft)]">
                From $29/month. Cancel in one click — your agents keep everything
                they made.
              </p>
            </div>
          </Reveal>

          <Reveal delay={240}>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-[var(--color-ink-soft)]">
              <li>✓ No credit card to look around</li>
              <li>✓ Live in 90 seconds</li>
              <li>✓ Your keys, encrypted</li>
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
