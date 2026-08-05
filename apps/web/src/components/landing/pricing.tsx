import { Check } from "lucide-react";
import { PlanButton } from "./plan-button";
import { Reveal } from "@/components/ui/reveal";
import { PLAN_LIST } from "@/lib/plans";
import { TOTAL_MONTHLY_REPLACED, formatUsd } from "@/lib/templates";

/**
 * Two plans, billed monthly.
 *
 * The anchor does the work: the stack total sits directly above the price, so
 * $29 is read against $1,354 rather than against zero. A third tier was
 * considered and cut — every extra column is another decision, and a visitor
 * who is deciding is a visitor who is not buying.
 */
export function Pricing({ signedIn = false }: { signedIn?: boolean }) {
  return (
    <section
      id="pricing"
      className="border-b border-line px-5 py-16 sm:py-24"
    >
      <div className="mx-auto max-w-4xl">
        <Reveal>
          <h2 className="text-3xl font-extrabold sm:text-5xl">
            Cheaper than the cheapest thing you cancel.
          </h2>
          <p className="mt-4 max-w-xl text-lg text-muted">
            No free plan, no trial, no seats. One subscription, every agent it
            covers, cancel in one click.
          </p>
        </Reveal>

        <Reveal delay={80}>
          <div className="mt-8 flex flex-wrap items-baseline gap-3 rounded-xl border border-line bg-surface-2 px-5 py-4">
            <span className="text-sm font-medium text-muted">
              A normal stack:
            </span>
            <span className="text-2xl font-extrabold tabular-nums text-faint line-through">
              {formatUsd(TOTAL_MONTHLY_REPLACED)}/mo
            </span>
            <span className="text-sm text-muted">→</span>
            <span className="text-2xl font-extrabold text-accent">
              $29/mo
            </span>
          </div>
        </Reveal>

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {PLAN_LIST.map((plan, index) => (
            <Reveal key={plan.tier} delay={index * 90}>
              <div
                className={
                  plan.highlight
                    ? "relative h-full rounded-2xl border-2 border-accent bg-surface p-7"
                    : "h-full rounded-2xl border border-line bg-surface p-7"
                }
              >
                {plan.highlight ? (
                  <span className="absolute -top-3 left-7 rounded-full bg-accent px-3 py-1 text-xs font-bold uppercase tracking-wide text-accent-fg">
                    Replaces the most
                  </span>
                ) : null}

                <h3 className="text-lg font-bold">{plan.name}</h3>
                <p className="mt-1 text-[15px] text-muted">
                  {plan.tagline}
                </p>

                <div className="mt-5 flex items-baseline gap-1.5">
                  <span className="text-5xl font-extrabold tracking-tight">
                    ${plan.priceUsd}
                  </span>
                  <span className="text-base font-medium text-muted">
                    /month
                  </span>
                </div>

                <ul className="mt-6 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5">
                      <Check className="mt-0.5 size-4 shrink-0 text-accent" />
                      <span className="text-[15px] leading-snug">{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-7">
                  <PlanButton
                    plan={plan.tier}
                    signedIn={signedIn}
                    size="md"
                    variant={plan.highlight ? "primary" : "ink"}
                  >
                    {plan.cta}
                  </PlanButton>
                  <p className="mt-2.5 text-center text-xs text-muted">
                    {plan.ctaSubtext}
                  </p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={200}>
          <p className="mt-6 text-sm leading-relaxed text-muted">
            You bring your own OpenAI key, so you pay OpenAI directly for what
            your agents generate — usually under $2 a month. We never mark it up,
            and we never hold a key that can spend your money.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
