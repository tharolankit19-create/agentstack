import { Check } from "lucide-react";
import { BuyButton } from "./buy-button";
import { PLAN_LIST } from "@/lib/plans";

/**
 * Two choices, one payment, no free plan.
 *
 * A third tier was considered and cut: every extra column is another decision,
 * and a visitor who is deciding is a visitor who is not buying.
 */
export function Pricing() {
  return (
    <section
      id="pricing"
      className="border-b border-[var(--color-line)] px-5 py-16 sm:py-24"
    >
      <div className="mx-auto max-w-4xl">
        <h2 className="text-3xl font-extrabold sm:text-4xl">
          Pay once. Use it forever.
        </h2>
        <p className="mt-4 max-w-xl text-lg text-[var(--color-ink-soft)]">
          There is no free plan and no monthly bill. You buy it, you own it, and
          the agents keep running.
        </p>

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {PLAN_LIST.map((plan) => (
            <div
              key={plan.tier}
              className={
                plan.highlight
                  ? "relative rounded-2xl border-2 border-[var(--color-accent)] bg-white p-7"
                  : "rounded-2xl border border-[var(--color-line)] bg-white p-7"
              }
            >
              {plan.highlight ? (
                <span className="absolute -top-3 left-7 rounded-full bg-[var(--color-accent)] px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
                  Most people buy this
                </span>
              ) : null}

              <h3 className="text-lg font-bold">{plan.name}</h3>
              <p className="mt-1 text-[15px] text-[var(--color-ink-soft)]">
                {plan.tagline}
              </p>

              <div className="mt-5 flex items-baseline gap-2">
                <span className="text-5xl font-extrabold tracking-tight">
                  ${plan.priceUsd}
                </span>
                <span className="text-base font-medium text-[var(--color-ink-soft)]">
                  once
                </span>
              </div>

              <ul className="mt-6 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5">
                    <Check className="mt-0.5 size-4 shrink-0 text-[var(--color-accent)]" />
                    <span className="text-[15px] leading-snug">{feature}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-7">
                <BuyButton
                  plan={plan.tier}
                  size="md"
                  variant={plan.highlight ? "primary" : "ink"}
                  className="w-full"
                >
                  {plan.cta}
                </BuyButton>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-6 text-sm text-[var(--color-ink-soft)]">
          You bring your own OpenAI key, so you pay OpenAI directly for what your
          agents generate — usually under $2 a month. We never mark it up.
        </p>
      </div>
    </section>
  );
}
