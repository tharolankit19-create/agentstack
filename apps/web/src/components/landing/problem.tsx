import { Reveal, CountUp } from "@/components/ui/reveal";
import { SITE } from "@/lib/site";
import { TOTAL_MONTHLY_REPLACED, REPLACED_TOOLS } from "@/lib/templates";

/**
 * Empathy before the pitch. Describe the problem better than they can, and the
 * solution stops needing an explanation.
 *
 * This is the section a competitor cannot copy: it is written from inside the
 * job, not from a feature list.
 */
export function Problem() {
  return (
    <section className="border-b border-line px-5 py-16 sm:py-24">
      <div className="mx-auto max-w-3xl">
        <Reveal>
          <h2 className="text-3xl font-extrabold sm:text-5xl">
            You did not choose a stack.
            <br />
            It accumulated.
          </h2>
        </Reveal>

        <Reveal delay={80}>
          <div className="mt-8 space-y-5 text-lg leading-relaxed text-muted">
            <p>
              One tool for scheduling posts. Another for the newsletter. A third
              because the first one could not do reviews. Each was $29 the month
              you signed up, and each was obviously worth it.
            </p>
            <p>
              Now the card statement runs to four figures, you log into three of
              them, and the other nine renew quietly on the 4th of every month.
            </p>
            <p className="font-semibold text-fg">
              You are not paying for software. You are paying for twelve
              dashboards you do not open, to do work that nobody is doing.
            </p>
          </div>
        </Reveal>

        <Reveal delay={160}>
          <div className="mt-12 rounded-2xl border border-line p-6 sm:p-8">
            <p className="text-sm font-bold uppercase tracking-wider text-faint">
              What a normal stack costs
            </p>
            <p className="mt-3 text-5xl font-extrabold tracking-tight sm:text-6xl">
              <CountUp to={TOTAL_MONTHLY_REPLACED} prefix="$" />
              <span className="text-2xl font-bold text-faint">
                /month
              </span>
            </p>
            <p className="mt-4 text-[15px] leading-relaxed text-muted">
              {REPLACED_TOOLS.join(" · ")}
            </p>
            <p className="mt-5 border-t border-line pt-4 text-lg font-bold">
              {SITE.name} replaces every one of those for $29.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
