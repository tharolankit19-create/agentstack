import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AgentLeaderboard } from "./agent-leaderboard";
import { LogoStrip } from "./logo-strip";
import { REPLACEABLES, countByVerdict } from "@/lib/replaceability";
import { TEMPLATES } from "@/lib/templates";
import { PLANS } from "@/lib/plans";

/**
 * The top of the page, and then immediately the thing the page is about.
 *
 * There is no illustration and no card of feature bullets, because neither
 * answers the question the visitor arrived with — which of the things I pay
 * for can stop. The list answers it, so the list starts about one screen down
 * and everything above it is setup.
 *
 * The call to action names the outcome and the price in the same breath. "Get
 * started" and "Try it free" are what you write when you do not want to say
 * what happens next; this one says exactly what happens next, and the line
 * under it removes the only objection that stops the click.
 *
 * Every number is computed. A landing page that claims a figure the product
 * cannot produce is the first thing a sceptic checks.
 */
export function Hero() {
  const counts = countByVerdict();

  return (
    <section className="grid-field border-b border-line px-5 pb-16 pt-12 sm:pt-16">
      <div className="mx-auto max-w-6xl">
        <h1 className="max-w-4xl text-[44px] sm:text-[76px]">
          Cancel {counts.yes} subscriptions.
          <br />
          <span className="text-money">Keep every job they did.</span>
        </h1>

        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted">
          Tick what is on your card. An agent takes each job over, live on its
          own URL in ninety seconds, running on a schedule without you — and we
          tell you to{" "}
          <span className="font-semibold text-fg">keep paying for {counts.no}</span>{" "}
          of the {counts.total} tools on this list.
        </p>

        <div className="mt-9 flex flex-col gap-4 sm:flex-row sm:items-center">
          <Link
            href="/login?mode=signup"
            className="group inline-flex h-14 items-center justify-center gap-2.5 rounded-xl bg-accent px-7 text-[17px] font-semibold text-accent-fg transition-transform hover:scale-[1.02] active:translate-y-px"
          >
            Deploy my first agent — free
            <ArrowRight className="size-5 transition-transform group-hover:translate-x-0.5" />
          </Link>

          <p className="text-sm text-muted">
            No card to look.{" "}
            <span className="font-semibold text-fg">
              ${PLANS.starter.priceUsd}/mo
            </span>{" "}
            only when you switch one on.
            <br className="hidden sm:block" />
            <span className="text-faint">
              {TEMPLATES.length} agents ready · cancel in one click
            </span>
          </p>
        </div>

        {/* The wall of things they already pay for. Recognition first, argument
            second. */}
        <div className="mt-12">
          <LogoStrip entries={REPLACEABLES} />
        </div>

        {/* The list. Everything above it exists to get here. */}
        <div className="mt-10" id="list">
          <AgentLeaderboard entries={REPLACEABLES} />
        </div>
      </div>
    </section>
  );
}
