import Link from "next/link";
import { Check } from "lucide-react";
import { Reveal } from "@/components/ui/reveal";
import { PLAN_LIST } from "@/lib/plans";
import { TOTAL_MONTHLY_REPLACED, formatUsd } from "@/lib/templates";

/**
 * Two plans, three days free, no card up front.
 *
 * This replaced a credits page, and the reason is what founders did with it:
 * a price list of eight line items answers "what does an action cost" before
 * anyone has decided they want any actions. Metered pricing is honest and it is
 * also a spreadsheet to fill in, and a spreadsheet at the top of a funnel is a
 * reason to leave and think about it.
 *
 * The trial does the work instead. The product's whole argument is that you
 * wake up and something has happened without you, and that argument cannot be
 * made in copy — it needs a morning to pass. Three days contains three of them.
 *
 * Two plans, not three. Three makes the middle one a decision and the cheapest
 * one look crippled; two is a single question about volume, which is the only
 * question anyone can answer before they have used it.
 */
export function Pricing({ signedIn = false }: { signedIn?: boolean }) {
  return (
    <section id="pricing" className="border-b border-line px-5 py-20 sm:py-28">
      <div className="mx-auto max-w-5xl">
        <Reveal>
          <h2 className="max-w-3xl text-3xl font-extrabold tracking-[-0.02em] sm:text-5xl">
            Three days free.
            <br />
            Then less than a morning of a freelancer.
          </h2>
          <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-muted">
            No card to start. Your agents run for three days — you get three
            morning briefings, three batches of leads, and whatever they turn up
            about your competitors while you sleep. Cancel in one click and keep
            everything they made.
          </p>
        </Reveal>

        {/* The comparison, computed rather than typed. A number written by hand
            here goes stale silently and is read by exactly the person deciding
            whether to believe the rest of the page. */}
        <Reveal delay={60}>
          <p className="mt-8 inline-flex flex-wrap items-baseline gap-2.5 rounded-[var(--r-panel)] border border-line bg-surface px-4 py-3 text-[15px]">
            <span className="text-muted">The stack this replaces:</span>
            <span className="font-extrabold tabular-nums text-faint line-through">
              {formatUsd(TOTAL_MONTHLY_REPLACED)}/mo
            </span>
            <span className="text-faint">→</span>
            <span className="font-extrabold text-accent">
              ${PLAN_LIST[0].priceUsd}/mo
            </span>
          </p>
        </Reveal>

        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          {PLAN_LIST.map((plan, index) => (
            <Reveal key={plan.tier} delay={100 + index * 70}>
              <div
                className={`flex h-full flex-col rounded-[var(--r-panel)] border bg-surface p-6 sm:p-7 ${
                  plan.highlight
                    ? "border-accent-line shadow-[var(--shadow-lg)]"
                    : "border-line shadow-[var(--shadow)]"
                }`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-lg font-bold text-fg-strong">{plan.name}</h3>
                  {plan.highlight ? (
                    <span className="stamp stamp-live">most take this</span>
                  ) : null}
                </div>

                <p className="mt-1 text-[15px] text-muted">{plan.tagline}</p>

                <p className="mt-5 flex items-baseline gap-1.5">
                  <span className="text-5xl font-extrabold tracking-[-0.03em] text-fg-strong">
                    ${plan.priceUsd}
                  </span>
                  <span className="text-[15px] text-muted">/month</span>
                </p>

                <ul className="mt-6 flex-1 space-y-2.5">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-2.5 text-[14.5px] leading-snug">
                      <Check className="mt-0.5 size-4 shrink-0 text-money" aria-hidden />
                      <span className="text-fg">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={signedIn ? "/dashboard" : "/login?mode=signup"}
                  className={`mt-7 inline-flex h-12 items-center justify-center rounded-[var(--r-control)] text-[15px] font-semibold transition-all active:translate-y-px ${
                    plan.highlight
                      ? "bg-accent text-accent-fg shadow-[var(--raise)] hover:shadow-[var(--raise-hover)]"
                      : "border border-line bg-surface-2 text-fg-strong hover:border-accent-line"
                  }`}
                >
                  {signedIn ? "Open your dashboard" : plan.cta}
                </Link>

                <p className="mt-2.5 text-center text-[13px] text-faint">
                  {plan.ctaSubtext}
                </p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={280}>
          <p className="mt-9 max-w-2xl text-sm leading-relaxed text-faint">
            Every key the agents run on is ours — the models, the lead data, the
            web reader. You never sign up for anything else and you never paste
            an API key. A free account can look at all of it, connect Telegram
            and set up its brand; running the agents is what the trial is for.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
