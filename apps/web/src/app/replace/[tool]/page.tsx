import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, Check, Minus, X } from "lucide-react";
import { Header } from "@/components/landing/header";
import { Footer } from "@/components/landing/footer";
import { SignupButton } from "@/components/landing/signup-button";
import { PriceSwap } from "@/components/landing/price-swap";
import { Reveal } from "@/components/ui/reveal";
import { getSession } from "@/lib/auth";
import {
  REPLACEABLES,
  VERDICT_COPY,
  getReplaceable,
  templateFor,
  type Verdict,
} from "@/lib/replaceability";

/**
 * One page per tool.
 *
 * Someone searching "Hootsuite alternative" should land on a page about
 * Hootsuite, not a page about us. The verdict comes first, before any pitch —
 * including when the verdict is "keep paying for it", which is the whole
 * reason anyone forwards one of these.
 */

export function generateStaticParams() {
  return REPLACEABLES.map((entry) => ({ tool: entry.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tool: string }>;
}): Promise<Metadata> {
  const { tool } = await params;
  const entry = getReplaceable(tool);
  if (!entry) return { title: "Not found" };

  const verdict =
    entry.verdict === "no"
      ? `Keep paying for ${entry.tool}`
      : entry.verdict === "partial"
        ? `${entry.tool}: partly replaceable`
        : `Replace ${entry.tool} with an agent`;

  return {
    title: verdict,
    description: `${entry.honestTake.slice(0, 155)}…`,
    openGraph: { title: verdict, description: entry.job, url: `/replace/${entry.slug}` },
    twitter: { card: "summary_large_image", title: verdict, description: entry.job },
  };
}

export default async function ReplaceToolPage({
  params,
}: {
  params: Promise<{ tool: string }>;
}) {
  const [{ tool }, session] = await Promise.all([
    params,
    getSession().catch(() => null),
  ]);

  const entry = getReplaceable(tool);
  if (!entry) notFound();

  const template = templateFor(entry);
  const related = REPLACEABLES.filter(
    (other) => other.slug !== entry.slug && other.verdict === entry.verdict,
  ).slice(0, 6);

  return (
    <>
      <Header signedIn={Boolean(session)} />

      <main>
        <section className="border-b border-[var(--color-line)] px-5 py-12 sm:py-16">
          <div className="mx-auto max-w-3xl">
            <Link
              href="/replace"
              className="inline-flex items-center gap-1.5 text-sm text-[var(--color-ink-soft)] transition-colors hover:text-[var(--color-ink)]"
            >
              <ArrowLeft className="size-4" />
              All tools
            </Link>

            <Reveal>
              <VerdictBadge verdict={entry.verdict} />

              <h1 className="mt-5 text-[34px] font-extrabold leading-[1.08] sm:text-5xl">
                {entry.verdict === "no"
                  ? `Keep paying for ${entry.tool}.`
                  : entry.verdict === "partial"
                    ? `${entry.tool}: half of it.`
                    : `You can replace ${entry.tool}.`}
              </h1>

              <p className="mt-4 text-lg leading-relaxed text-[var(--color-ink-soft)]">
                <span className="font-semibold text-[var(--color-ink)]">
                  What you hire it for:
                </span>{" "}
                {entry.job}
              </p>
            </Reveal>

            {entry.verdict !== "no" ? (
              <PriceSwap toolName={entry.tool} monthlyUsd={entry.monthlyUsd} />
            ) : null}

            <Reveal delay={80}>
              <p className="mt-8 border-l-2 border-[var(--color-accent)] pl-5 text-lg leading-relaxed">
                {entry.honestTake}
              </p>
            </Reveal>
          </div>
        </section>

        {entry.verdict !== "no" ? (
          <section className="border-b border-[var(--color-line)] bg-[var(--color-paper-soft)] px-5 py-14">
            <div className="mx-auto grid max-w-3xl gap-8 sm:grid-cols-2">
              <Reveal>
                <h2 className="flex items-center gap-2 text-lg font-bold">
                  <Check className="size-5 text-emerald-600" />
                  What the agent does
                </h2>
                <ul className="mt-4 space-y-3">
                  {entry.does.map((line) => (
                    <li
                      key={line}
                      className="flex gap-2.5 text-[15px] leading-relaxed"
                    >
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-emerald-600" />
                      {line}
                    </li>
                  ))}
                </ul>
              </Reveal>

              <Reveal delay={80}>
                <h2 className="flex items-center gap-2 text-lg font-bold">
                  <X className="size-5 text-[var(--color-ink-faint)]" />
                  What it does not
                </h2>
                <ul className="mt-4 space-y-3">
                  {entry.doesNot.map((line) => (
                    <li
                      key={line}
                      className="flex gap-2.5 text-[15px] leading-relaxed text-[var(--color-ink-soft)]"
                    >
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-[var(--color-ink-faint)]" />
                      {line}
                    </li>
                  ))}
                </ul>
              </Reveal>
            </div>
          </section>
        ) : (
          <section className="border-b border-[var(--color-line)] bg-[var(--color-paper-soft)] px-5 py-14">
            <div className="mx-auto max-w-3xl">
              <Reveal>
                <h2 className="text-lg font-bold">
                  What we would not let an agent near
                </h2>
                <ul className="mt-4 space-y-3">
                  {entry.doesNot.map((line) => (
                    <li key={line} className="flex gap-2.5 text-[15px] leading-relaxed">
                      <X className="mt-0.5 size-4 shrink-0 text-[var(--color-ink-faint)]" />
                      {line}
                    </li>
                  ))}
                </ul>
                <p className="mt-6 text-[15px] leading-relaxed text-[var(--color-ink-soft)]">
                  We sell agents, and we are telling you not to buy one for this.
                  That is not modesty — it is the same judgement we apply to
                  every agent we do ship.
                </p>
              </Reveal>
            </div>
          </section>
        )}

        {template ? (
          <section className="border-b border-[var(--color-line)] px-5 py-14">
            <div className="mx-auto max-w-3xl">
              <Reveal>
                <p className="text-sm font-bold uppercase tracking-wider text-[var(--color-ink-faint)]">
                  The agent that does it
                </p>
                <div className="mt-4 rounded-2xl border border-[var(--color-line)] p-6">
                  <div className="flex items-start gap-4">
                    <span className="text-3xl" aria-hidden>
                      {template.icon}
                    </span>
                    <div className="min-w-0">
                      <h2 className="text-xl font-bold">{template.name}</h2>
                      <p className="mt-1.5 text-[15px] leading-relaxed text-[var(--color-ink-soft)]">
                        {template.description}
                      </p>
                      {template.examples?.length ? (
                        <div className="mt-4">
                          <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-ink-faint)]">
                            Things people ask it
                          </p>
                          <ul className="mt-2 space-y-1.5">
                            {template.examples.slice(0, 3).map((example) => (
                              <li
                                key={example}
                                className="text-[15px] text-[var(--color-ink-soft)]"
                              >
                                “{example}”
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </Reveal>

              <Reveal delay={80}>
                <div className="mt-8">
                  <SignupButton>See it running — free</SignupButton>
                  <p className="mt-3 text-sm text-[var(--color-ink-soft)]">
                    No card. Browse every agent, configure this one, and only pay
                    when you switch it on.
                  </p>
                </div>
              </Reveal>
            </div>
          </section>
        ) : null}

        {related.length > 0 ? (
          <section className="border-b border-[var(--color-line)] bg-[var(--color-paper-soft)] px-5 py-14">
            <div className="mx-auto max-w-3xl">
              <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--color-ink-faint)]">
                Also {VERDICT_COPY[entry.verdict].label.toLowerCase()}
              </h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {related.map((other) => (
                  <Link
                    key={other.slug}
                    href={`/replace/${other.slug}`}
                    className="rounded-full border border-[var(--color-line)] bg-white px-3.5 py-2 text-sm font-medium transition-colors hover:border-[var(--color-accent)]"
                  >
                    {other.tool}
                  </Link>
                ))}
              </div>
              <Link
                href="/replace"
                className="mt-6 inline-block text-sm font-semibold text-[var(--color-accent)] hover:underline"
              >
                See the full list →
              </Link>
            </div>
          </section>
        ) : null}
      </main>

      <Footer />
    </>
  );
}

function VerdictBadge({ verdict }: { verdict: Verdict }) {
  const styles: Record<Verdict, string> = {
    yes: "border-emerald-200 bg-emerald-50 text-emerald-700",
    partial: "border-amber-200 bg-amber-50 text-amber-700",
    no: "border-[var(--color-line)] bg-[var(--color-paper-soft)] text-[var(--color-ink-soft)]",
  };
  const Icon = verdict === "yes" ? Check : verdict === "partial" ? Minus : X;

  return (
    <span
      className={`mt-6 inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-bold ${styles[verdict]}`}
    >
      <Icon className="size-4" />
      {VERDICT_COPY[verdict].label}
    </span>
  );
}
