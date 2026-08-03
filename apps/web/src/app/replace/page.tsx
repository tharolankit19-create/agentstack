import Link from "next/link";
import type { Metadata } from "next";
import { Check, Minus, X } from "lucide-react";
import { Header } from "@/components/landing/header";
import { Footer } from "@/components/landing/footer";
import { Reveal } from "@/components/ui/reveal";
import { getSession } from "@/lib/auth";
import {
  REPLACEABLES,
  VERDICT_COPY,
  countByVerdict,
  replaceableMonthlyTotal,
  type Verdict,
} from "@/lib/replaceability";
import { formatUsd } from "@/lib/templates";

const counts = countByVerdict();

export const metadata: Metadata = {
  title: "Which of your SaaS tools can an agent actually replace?",
  description:
    `An honest list of ${counts.total} tools founders pay for, with a straight ` +
    `answer on each: replaceable, partly replaceable, or keep paying for it. ` +
    `${counts.no} of them we tell you not to replace.`,
  openGraph: {
    title: "Which of your SaaS tools can an agent actually replace?",
    description: `${counts.yes} yes. ${counts.partial} partly. ${counts.no} keep paying for.`,
    url: "/replace",
  },
};

/**
 * The public directory.
 *
 * This exists because the product had no surface anyone could see without
 * signing up — and a product nobody can look at does not get shared. It is
 * free, needs no account, and is built to be sent to a friend.
 *
 * The reason it works is the "no" column. Anyone can publish a list of things
 * their product replaces; that reads as an advertisement. A list that tells
 * you which subscriptions to keep is a reference, and it is only credible
 * because saying no costs us the sale.
 */
export default async function ReplaceIndexPage() {
  const session = await getSession().catch(() => null);
  const groups: { verdict: Verdict; blurb: string }[] = [
    {
      verdict: "yes",
      blurb: "An agent does this job end to end. Cancel with confidence.",
    },
    {
      verdict: "partial",
      blurb:
        "An agent does the work, but the tool also does something structural — sending, hosting, storing — that we do not.",
    },
    {
      verdict: "no",
      blurb:
        "Keep paying. These hold your data, take your money, or need judgement. Nobody should automate them, including us.",
    },
  ];

  return (
    <>
      <Header signedIn={Boolean(session)} />

      <main>
        <section className="border-b border-line px-5 py-14 sm:py-20">
          <div className="mx-auto max-w-4xl">
            <Reveal>
              <p className="text-sm font-bold uppercase tracking-wider text-accent">
                Free · no signup
              </p>
              <h1 className="mt-4 text-[38px] font-extrabold leading-[1.05] sm:text-6xl">
                What can an agent
                <br />
                actually replace?
              </h1>
            </Reveal>

            <Reveal delay={80}>
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted sm:text-xl">
                {counts.total} tools founders pay for, with a straight answer on
                each one. We built agents for {counts.yes} of them. We will tell
                you to keep paying for {counts.no}.
              </p>
            </Reveal>

            <Reveal delay={140}>
              <dl className="mt-8 grid gap-3 sm:grid-cols-3">
                <Stat
                  value={String(counts.yes)}
                  label="Replaceable"
                  tone="text-live"
                />
                <Stat
                  value={String(counts.partial)}
                  label="Partly"
                  tone="text-money"
                />
                <Stat
                  value={String(counts.no)}
                  label="Keep paying"
                  tone="text-muted"
                />
              </dl>
            </Reveal>

            <Reveal delay={200}>
              <p className="mt-6 rounded-xl border border-line bg-surface-2 px-5 py-4 text-[15px] leading-relaxed text-muted">
                The fully replaceable ones add up to{" "}
                <span className="font-bold text-fg">
                  {formatUsd(replaceableMonthlyTotal())}/month
                </span>{" "}
                at list price. That is the number worth arguing with — click any
                tool and we will show our working.
              </p>
            </Reveal>
          </div>
        </section>

        {groups.map((group, groupIndex) => {
          const entries = REPLACEABLES.filter((e) => e.verdict === group.verdict);
          if (entries.length === 0) return null;

          return (
            <section
              key={group.verdict}
              className={
                groupIndex % 2 === 1
                  ? "border-b border-line bg-surface-2 px-5 py-14"
                  : "border-b border-line px-5 py-14"
              }
            >
              <div className="mx-auto max-w-4xl">
                <Reveal>
                  <h2 className="flex flex-wrap items-baseline gap-3 text-2xl font-extrabold sm:text-3xl">
                    <VerdictIcon verdict={group.verdict} />
                    {VERDICT_COPY[group.verdict].label}
                    <span className="text-base font-semibold text-faint">
                      {entries.length}
                    </span>
                  </h2>
                  <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted">
                    {group.blurb}
                  </p>
                </Reveal>

                <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {entries.map((entry, index) => (
                    <Reveal key={entry.slug} delay={Math.min(index, 8) * 35}>
                      <Link
                        href={`/replace/${entry.slug}`}
                        className="group flex h-full flex-col rounded-xl border border-line bg-surface p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-accent hover:shadow-[0_8px_30px_rgba(139,92,246,0.10)]"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-bold">{entry.tool}</span>
                          {entry.monthlyUsd > 0 ? (
                            <span className="shrink-0 text-xs font-bold tabular-nums text-faint">
                              ${entry.monthlyUsd}/mo
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1.5 flex-1 text-sm leading-snug text-muted">
                          {entry.job}
                        </p>
                        <span className="mt-3 text-xs font-semibold text-accent opacity-0 transition-opacity group-hover:opacity-100">
                          See the honest answer →
                        </span>
                      </Link>
                    </Reveal>
                  ))}
                </div>
              </div>
            </section>
          );
        })}

        <section className="border-b border-line px-5 py-14">
          <div className="mx-auto max-w-2xl">
            <Reveal>
              <h2 className="text-2xl font-extrabold sm:text-3xl">
                Why we list the ones you should keep
              </h2>
              <div className="mt-4 space-y-4 text-[17px] leading-relaxed text-muted">
                <p>
                  Every company selling AI agents publishes a list of things
                  their agents replace. That list is an advertisement and you
                  read it as one, which is why it does not change what you do on
                  Monday.
                </p>
                <p>
                  So this one includes the tools we cannot replace, the ones we
                  only half replace, and what each agent specifically fails at.
                  Those entries cost us sales.
                </p>
                <p className="font-semibold text-fg">
                  They are also the only reason to believe the rest of the page.
                </p>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}

function Stat({
  value,
  label,
  tone,
}: {
  value: string;
  label: string;
  tone: string;
}) {
  return (
    <div className="rounded-xl border border-line p-4">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className={`mt-0.5 text-3xl font-extrabold tabular-nums ${tone}`}>
        {value}
      </dd>
    </div>
  );
}

function VerdictIcon({ verdict }: { verdict: Verdict }) {
  if (verdict === "yes") {
    return <Check className="size-6 text-live" aria-hidden />;
  }
  if (verdict === "partial") {
    return <Minus className="size-6 text-money" aria-hidden />;
  }
  return <X className="size-6 text-faint" aria-hidden />;
}
