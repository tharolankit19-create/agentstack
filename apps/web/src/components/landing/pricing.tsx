import { Check, Cloud, Infinity as InfinityIcon, RefreshCw, Server } from "lucide-react";
import { PlanButton } from "./plan-button";
import { Reveal } from "@/components/ui/reveal";
import { PLAN_LIST } from "@/lib/plans";
import { TEMPLATES, TOTAL_MONTHLY_REPLACED, formatUsd } from "@/lib/templates";

/**
 * Three plans, billed monthly.
 *
 * The anchor does the work: the stack total sits directly above the price, so
 * $29 is read against $1,354 rather than against zero.
 *
 * The single most important correction here is what the tiers are *about*. The
 * old version listed named agents per plan, which reads as a permission list —
 * "you may have the content one" — and immediately loses anyone whose problem
 * is reviews. Every plan has the entire library. What separates them is how
 * many run at once and whose servers they run on, and that is now the first
 * thing each card says.
 */
export function Pricing({ signedIn = false }: { signedIn?: boolean }) {
  return (
    <section id="pricing" className="border-b border-line px-5 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <h2 className="max-w-3xl text-3xl font-extrabold sm:text-5xl">
            Cheaper than the cheapest thing you cancel.
          </h2>
          <p className="mt-4 max-w-2xl text-lg text-muted">
            Every plan gets the whole library — all {TEMPLATES.length} agents,
            and every one we ship after today. You are not picking which agents
            you are allowed. You are picking{" "}
            <span className="font-semibold text-fg">how many run at once</span>{" "}
            and <span className="font-semibold text-fg">whose servers</span> they
            run on.
          </p>
        </Reveal>

        <Reveal delay={80}>
          <div className="mt-8 flex flex-wrap items-baseline gap-3 rounded-xl border border-line bg-surface-2 px-5 py-4">
            <span className="text-sm font-medium text-muted">A normal stack:</span>
            <span className="text-2xl font-extrabold tabular-nums text-faint line-through">
              {formatUsd(TOTAL_MONTHLY_REPLACED)}/mo
            </span>
            <span className="text-sm text-muted">→</span>
            <span className="text-2xl font-extrabold text-accent">$29/mo</span>
          </div>
        </Reveal>

        {/* Said once, above all three, rather than repeated in every column. */}
        <Reveal delay={120}>
          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted">
            <span className="inline-flex items-center gap-2">
              <RefreshCw className="size-4 text-live" aria-hidden />
              New agents ship most days &mdash;{" "}
              <span className="font-semibold text-fg">every plan gets them free</span>
            </span>
            <span className="inline-flex items-center gap-2">
              <InfinityIcon className="size-4 text-live" aria-hidden />
              Lifetime updates while you are subscribed
            </span>
          </div>
        </Reveal>

        <div className="mt-10 grid gap-5 lg:grid-cols-3">
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
                    We host it for you
                  </span>
                ) : null}

                <h3 className="text-lg font-bold">{plan.name}</h3>
                <p className="mt-1 text-[15px] text-muted">{plan.tagline}</p>

                <div className="mt-5 flex items-baseline gap-1.5">
                  <span className="text-5xl font-extrabold tracking-tight">
                    ${plan.priceUsd}
                  </span>
                  <span className="text-base font-medium text-muted">/month</span>
                </div>

                {/* The two facts that actually separate the tiers, first and
                    in the same place on every card so they can be compared
                    without reading a feature list. */}
                <div className="mt-5 space-y-2 rounded-xl border border-line bg-surface-2 p-4">
                  <p className="flex items-center gap-2 text-[15px] font-bold text-fg-strong">
                    {plan.agentQuota >= 999 ? (
                      <InfinityIcon className="size-4 shrink-0 text-accent" aria-hidden />
                    ) : (
                      <Check className="size-4 shrink-0 text-accent" aria-hidden />
                    )}
                    {plan.quotaLabel}, any from the library
                  </p>
                  <p className="flex items-start gap-2 text-sm text-muted">
                    {plan.hosting === "managed" ? (
                      <Cloud className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
                    ) : (
                      <Server className="mt-0.5 size-4 shrink-0 text-faint" aria-hidden />
                    )}
                    {plan.hostingLine}
                  </p>
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

        <Reveal delay={240}>
          <p className="mt-6 text-sm leading-relaxed text-muted">
            You bring your own OpenAI key on every plan, so you pay OpenAI
            directly for what your agents generate — usually under $2 a month.
            We never mark it up, and we never hold a key that can spend your
            money.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
