import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, Check, Minus, X } from "lucide-react";
import { Header } from "@/components/landing/header";
import { Footer } from "@/components/landing/footer";
import { SignupButton } from "@/components/landing/signup-button";
import { PriceSwap } from "@/components/landing/price-swap";
import { FreeAlternatives } from "@/components/landing/free-alternatives";
import { ToolSchema } from "@/components/landing/tool-schema";
import { appUrl } from "@/lib/deploy";
import { Reveal } from "@/components/ui/reveal";
import { ToolIcon } from "@/components/ui/tool-icon";
import { getSession } from "@/lib/auth";
import { CATEGORY_LABEL } from "@/lib/categories";
import {
  REPLACEABLES,
  VERDICT_COPY,
  freeAlternatives,
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

/**
 * Titles written for the query, not for us.
 *
 * Nobody searches "AgentStack Hootsuite page". They search "Hootsuite
 * alternative", "cancel Hootsuite", "is Hootsuite worth it" — so the title
 * leads with the tool name and the intent, and the verdict word ("alternative"
 * vs "worth keeping") matches what the page actually concludes. A title
 * promising an alternative on a page that says keep paying is the fastest way
 * to teach a search engine that this site is not worth ranking.
 */
function titleFor(entry: { tool: string; verdict: Verdict }): string {
  if (entry.verdict === "no") return `Is ${entry.tool} worth paying for? (We say yes)`;
  if (entry.verdict === "partial") return `${entry.tool} alternative — what an AI agent can and cannot replace`;
  return `${entry.tool} alternative — replace it with an AI agent for $29/mo`;
}

function descriptionFor(entry: {
  tool: string;
  verdict: Verdict;
  monthlyUsd: number;
  honestTake: string;
}): string {
  const price = entry.monthlyUsd > 0 ? ` ${entry.tool} costs about $${entry.monthlyUsd}/mo.` : "";
  const lead =
    entry.verdict === "no"
      ? `An honest look at whether you can cancel ${entry.tool}. Short answer: don't.`
      : entry.verdict === "partial"
        ? `What an AI agent genuinely replaces about ${entry.tool}, and what it does not.`
        : `${entry.tool} does one job. Here is the agent that does it, what it costs, and the free alternatives worth knowing about.`;

  return `${lead}${price} ${entry.honestTake.slice(0, 110)}…`.slice(0, 300);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tool: string }>;
}): Promise<Metadata> {
  const { tool } = await params;
  const entry = getReplaceable(tool);
  if (!entry) return { title: "Not found" };

  const title = titleFor(entry);
  const description = descriptionFor(entry);
  const url = `/replace/${entry.slug}`;

  return {
    title,
    description,
    // One canonical per tool. Without it the same page reachable with tracking
    // params reads as duplicate content across 891 URLs, which is exactly the
    // scale at which that starts costing rankings.
    alternates: { canonical: url },
    keywords: [
      `${entry.tool} alternative`,
      `cancel ${entry.tool}`,
      `${entry.tool} replacement`,
      `free ${entry.tool} alternative`,
      `${entry.tool} AI agent`,
    ],
    openGraph: { title, description, url, type: "article" },
    twitter: { card: "summary_large_image", title, description },
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
  const alternatives = freeAlternatives(entry);

  // Same verdict, but tools from the same part of the business first — someone
  // reading about Calendly is far more likely to also pay for Notion than for
  // whichever tool happens to sort next alphabetically.
  const sameVerdict = REPLACEABLES.filter(
    (other) => other.slug !== entry.slug && other.verdict === entry.verdict,
  );
  const related = [
    ...sameVerdict.filter((other) => other.category === entry.category),
    ...sameVerdict.filter((other) => other.category !== entry.category),
  ].slice(0, 6);

  return (
    <>
      {/* Rich-result markup for the questions this page actually answers. */}
      <ToolSchema
        entry={entry}
        alternatives={alternatives}
        agentName={template?.name}
        siteUrl={appUrl()}
      />

      <Header signedIn={Boolean(session)} />

      <main>
        <section className="border-b border-line px-5 py-12 sm:py-16">
          <div className="mx-auto max-w-3xl">
            <Link
              href="/replace"
              className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg"
            >
              <ArrowLeft className="size-4" />
              All tools
            </Link>

            <Reveal>
              <div className="mt-5 flex items-center gap-3">
                <ToolIcon
                  domain={entry.domain}
                  name={entry.tool}
                  className="size-12 rounded-xl border border-line bg-surface p-1.5"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <VerdictBadge verdict={entry.verdict} />
                  <span className="rounded-full border border-line px-2.5 py-1 text-xs font-semibold text-muted">
                    {CATEGORY_LABEL[entry.category]}
                  </span>
                </div>
              </div>

              <h1 className="mt-5 text-[34px] font-extrabold leading-[1.08] sm:text-5xl">
                {entry.verdict === "no"
                  ? `Keep paying for ${entry.tool}.`
                  : entry.verdict === "partial"
                    ? `${entry.tool}: half of it.`
                    : `You can replace ${entry.tool}.`}
              </h1>

              <p className="mt-4 text-lg leading-relaxed text-muted">
                <span className="font-semibold text-fg">
                  What you hire it for:
                </span>{" "}
                {entry.job}
              </p>
            </Reveal>

            {entry.verdict !== "no" ? (
              <PriceSwap toolName={entry.tool} monthlyUsd={entry.monthlyUsd} />
            ) : null}

            <Reveal delay={80}>
              <p className="mt-8 border-l-2 border-accent pl-5 text-lg leading-relaxed">
                {entry.honestTake}
              </p>
            </Reveal>
          </div>
        </section>

        {entry.verdict !== "no" ? (
          <section className="border-b border-line bg-surface-2 px-5 py-14">
            <div className="mx-auto grid max-w-3xl gap-8 sm:grid-cols-2">
              <Reveal>
                <h2 className="flex items-center gap-2 text-lg font-bold">
                  <Check className="size-5 text-live" />
                  What the agent does
                </h2>
                <ul className="mt-4 space-y-3">
                  {entry.does.map((line) => (
                    <li
                      key={line}
                      className="flex gap-2.5 text-[15px] leading-relaxed"
                    >
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-live" />
                      {line}
                    </li>
                  ))}
                </ul>
              </Reveal>

              <Reveal delay={80}>
                <h2 className="flex items-center gap-2 text-lg font-bold">
                  <X className="size-5 text-faint" />
                  What it does not
                </h2>
                <ul className="mt-4 space-y-3">
                  {entry.doesNot.map((line) => (
                    <li
                      key={line}
                      className="flex gap-2.5 text-[15px] leading-relaxed text-muted"
                    >
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-[var(--faint)]" />
                      {line}
                    </li>
                  ))}
                </ul>
              </Reveal>
            </div>
          </section>
        ) : (
          <section className="border-b border-line bg-surface-2 px-5 py-14">
            <div className="mx-auto max-w-3xl">
              <Reveal>
                <h2 className="text-lg font-bold">
                  What we would not let an agent near
                </h2>
                <ul className="mt-4 space-y-3">
                  {entry.doesNot.map((line) => (
                    <li key={line} className="flex gap-2.5 text-[15px] leading-relaxed">
                      <X className="mt-0.5 size-4 shrink-0 text-faint" />
                      {line}
                    </li>
                  ))}
                </ul>
                <p className="mt-6 text-[15px] leading-relaxed text-muted">
                  We sell agents, and we are telling you not to buy one for this.
                  That is not modesty — it is the same judgement we apply to
                  every agent we do ship.
                </p>
              </Reveal>
            </div>
          </section>
        )}

        <FreeAlternatives
          toolName={entry.tool}
          alternatives={alternatives}
          hasAgent={Boolean(template)}
        />

        {template ? (
          <section className="border-b border-line px-5 py-14">
            <div className="mx-auto max-w-3xl">
              <Reveal>
                <p className="text-sm font-bold uppercase tracking-wider text-faint">
                  The agent that does it
                </p>
                <div className="mt-4 rounded-2xl border border-line p-6">
                  <div className="flex items-start gap-4">
                    <span className="text-3xl" aria-hidden>
                      {template.icon}
                    </span>
                    <div className="min-w-0">
                      <h2 className="text-xl font-bold">{template.name}</h2>
                      <p className="mt-1.5 text-[15px] leading-relaxed text-muted">
                        {template.description}
                      </p>
                      {template.examples?.length ? (
                        <div className="mt-4">
                          <p className="text-xs font-bold uppercase tracking-wider text-faint">
                            Things people ask it
                          </p>
                          <ul className="mt-2 space-y-1.5">
                            {template.examples.slice(0, 3).map((example) => (
                              <li
                                key={example}
                                className="text-[15px] text-muted"
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
                  {/* Carries the agent through signup. Landing someone on a
                      generic dashboard after they clicked a specific tool's
                      page makes them find it again, which is the moment most
                      of them stop. */}
                  <SignupButton next={`/dashboard?agent=${template.id}`}>
                    Deploy this agent — 1 day trial
                  </SignupButton>
                  <p className="mt-3 text-sm text-muted">
                    No card. It turns on immediately, and you only pay if you
                    want to keep it past the first hour.
                  </p>
                </div>
              </Reveal>
            </div>
          </section>
        ) : null}

        {related.length > 0 ? (
          <section className="border-b border-line bg-surface-2 px-5 py-14">
            <div className="mx-auto max-w-3xl">
              <h2 className="text-sm font-bold uppercase tracking-wider text-faint">
                Also {VERDICT_COPY[entry.verdict].label.toLowerCase()}
              </h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {related.map((other) => (
                  <Link
                    key={other.slug}
                    href={`/replace/${other.slug}`}
                    className="inline-flex items-center gap-2 rounded-full border border-line bg-surface py-2 pl-2.5 pr-3.5 text-sm font-medium transition-colors hover:border-accent"
                  >
                    <ToolIcon
                      domain={other.domain}
                      name={other.tool}
                      className="size-4 rounded"
                    />
                    {other.tool}
                  </Link>
                ))}
              </div>
              <Link
                href="/replace"
                className="mt-6 inline-block text-sm font-semibold text-accent hover:underline"
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
    yes: "border-[var(--live-line)] bg-[var(--live-wash)] text-live",
    partial: "border-[var(--money-line)] bg-[var(--money-wash)] text-money",
    no: "border-line bg-surface-2 text-muted",
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
