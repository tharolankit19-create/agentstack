import { SignupButton } from "./signup-button";
import { AgentLeaderboard } from "./agent-leaderboard";
import { REPLACEABLES, countByVerdict } from "@/lib/replaceability";
import { TEMPLATES } from "@/lib/templates";

/**
 * The top of the page, and then immediately the thing the page is about.
 *
 * There is no illustration, no product shot and no card of feature bullets,
 * because none of those answer the question the visitor arrived with — which
 * of the things I pay for can stop. The list answers it, so the list starts
 * about four hundred pixels down and everything above it is one sentence of
 * setup.
 *
 * The counts are computed, not written. A landing page that claims a number
 * the product cannot produce is the first thing a sceptic checks.
 */
export function Hero() {
  const counts = countByVerdict();

  return (
    <section className="grid-field border-b border-line px-5 pb-16 pt-14 sm:pt-20">
      <div className="mx-auto max-w-6xl">
        <p className="badge-live">
          <span className="pulse-dot" aria-hidden />
          {TEMPLATES.length} agents running right now
        </p>

        <h1 className="mt-6 max-w-4xl text-[44px] sm:text-[76px]">
          Which of these are you
          <br />
          still paying for?
        </h1>

        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted">
          {counts.total} tools, one straight answer each. Tick the ones on your
          card and the number at the bottom is yours, not ours — we tell you to{" "}
          <span className="font-semibold text-fg">keep paying for {counts.no}</span>{" "}
          of them.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
          <SignupButton>Show me my stack — free</SignupButton>
          <span className="font-mono text-xs uppercase tracking-wider text-faint">
            no card · $29/mo only when you switch an agent on
          </span>
        </div>

        {/* The list. Everything above it exists to get here. */}
        <div className="mt-12" id="list">
          <AgentLeaderboard entries={REPLACEABLES} />
        </div>
      </div>
    </section>
  );
}
