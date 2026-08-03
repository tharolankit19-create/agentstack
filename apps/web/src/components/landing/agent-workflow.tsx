"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * An agent, running, on the landing page.
 *
 * Everything above this section is a claim. This is the only part of the page
 * that shows the thing actually happening, which makes it the part that sells.
 *
 * Three rules kept it from becoming decoration:
 *
 *   1. **The steps are the real ones.** Read the page, find the angle, draft,
 *      save. Same order the deployed agent runs in. Nothing invented to look
 *      busy — no fake "analysing sentiment" step.
 *   2. **It only runs while you can see it.** IntersectionObserver pauses the
 *      whole thing off-screen, so it is not burning a timer in a background tab.
 *   3. **Reduced motion gets the finished state**, not a broken one. The
 *      information is in the content, and the animation only paces it.
 */

interface Step {
  label: string;
  detail: string;
  /** Milliseconds this step appears to take. Uneven on purpose — real work is. */
  ms: number;
}

interface Run {
  agent: string;
  icon: string;
  trigger: string;
  steps: Step[];
  output: { kind: string; text: string }[];
  saved: string;
}

const RUNS: Run[] = [
  {
    agent: "Social Content Agent",
    icon: "✍️",
    trigger: "Weekday · 9:00am",
    steps: [
      { label: "Reading yoursite.com", detail: "12 headings, 2,400 words", ms: 1400 },
      { label: "Picking one angle", detail: "the onboarding claim", ms: 900 },
      { label: "Writing 5 tweets", detail: "different angle each", ms: 1600 },
      { label: "Writing 2 LinkedIn posts", detail: "hook first", ms: 1200 },
    ],
    output: [
      { kind: "Tweet", text: "Onboarding took 3 days. Now it takes 20 minutes." },
      { kind: "Tweet", text: "Nobody churns because of your pricing page." },
      { kind: "LinkedIn", text: "We deleted half our onboarding and activation went up." },
    ],
    saved: "7 drafts saved · Buffer, Hootsuite cancelled",
  },
  {
    agent: "Review Agent",
    icon: "⭐",
    trigger: "Every 6 hours",
    steps: [
      { label: "Checking G2", detail: "18 reviews, 2 new", ms: 1300 },
      { label: "Reading review #1", detail: "4 stars · Priya M.", ms: 800 },
      { label: "Drafting a reply", detail: "names the exact issue", ms: 1500 },
      { label: "Flagging review #2", detail: "2 stars — send this yourself", ms: 1000 },
    ],
    output: [
      {
        kind: "Reply",
        text: "You're right that the CSV export drops custom fields — that's fixed in this week's release.",
      },
      { kind: "Flagged", text: "2-star from Daniel R. — needs a human. Not sending." },
    ],
    saved: "2 replies drafted · Birdeye cancelled",
  },
  {
    agent: "Lead Agent",
    icon: "🎯",
    trigger: "Weekday · 8:00am",
    steps: [
      { label: "Reading your ICP", detail: "Heads of Growth, 20–200, US", ms: 900 },
      { label: "Searching Apollo", detail: "1,204 matches", ms: 1500 },
      { label: "Ranking by fit", detail: "keeping the top 25", ms: 1100 },
      { label: "Writing openers", detail: "one line each, no invented facts", ms: 1600 },
    ],
    output: [
      { kind: "Lead", text: "Sara K. — Head of Growth at Northwind · sara@…" },
      {
        kind: "Opener",
        text: "You're hiring two SDRs — worth seeing what the first one won't have to do.",
      },
    ],
    saved: "25 leads · Apollo, Clay cancelled",
  },
];

const OUTPUT_PAUSE = 2600;

export function AgentWorkflow() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [runIndex, setRunIndex] = useState(0);
  const [stepIndex, setStepIndex] = useState(-1);

  const run = RUNS[runIndex];
  const totalSteps = run.steps.length;
  const done = stepIndex >= totalSteps;

  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  // Only animate while on screen. A landing page should not run timers in a
  // tab nobody is looking at.
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0.25 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (reduced) {
      setStepIndex(totalSteps);
      return;
    }
    if (!visible) return;

    // Finished this run: hold on the output, then move to the next agent.
    if (done) {
      const timer = setTimeout(() => {
        setRunIndex((current) => (current + 1) % RUNS.length);
        setStepIndex(-1);
      }, OUTPUT_PAUSE);
      return () => clearTimeout(timer);
    }

    const delay = stepIndex < 0 ? 500 : run.steps[stepIndex].ms;
    const timer = setTimeout(() => setStepIndex((current) => current + 1), delay);
    return () => clearTimeout(timer);
  }, [visible, reduced, stepIndex, done, totalSteps, run.steps]);

  const progress = useMemo(
    () => Math.min(Math.max((stepIndex + 1) / totalSteps, 0), 1),
    [stepIndex, totalSteps],
  );

  return (
    <section className="bg-bg text-fg relative overflow-hidden border-b border-line px-5 py-16 sm:py-24">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 size-[40rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent opacity-[0.10] blur-[130px]"
      />

      <div ref={containerRef} className="relative mx-auto max-w-4xl">
        <div className="text-center">
          <p className="text-sm font-bold uppercase tracking-wider text-accent">
            This is the whole product
          </p>
          <h2 className="mt-4 text-3xl font-extrabold leading-tight text-fg-strong sm:text-5xl">
            It runs at 9am
            <br />
            whether you show up or not.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted">
            No canvas. No nodes to wire. You fill in four fields once, and this
            happens every morning.
          </p>
        </div>

        <div className="mt-12 overflow-hidden rounded-2xl border border-line bg-surface-2 shadow-2xl">
          {/* Header: which agent, and what woke it up. */}
          <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
            <span className="text-xl" aria-hidden>
              {run.icon}
            </span>
            <span className="font-bold text-fg-strong">{run.agent}</span>
            <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium text-muted">
              {run.trigger}
            </span>
            <span className="ml-auto flex items-center gap-2 text-xs font-medium text-muted">
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  done ? "bg-live" : "bg-accent",
                  !done && !reduced && "motion-safe:animate-pulse",
                )}
              />
              {done ? "done" : "running"}
            </span>
          </div>

          {/* Progress rail. The only element that moves continuously. */}
          <div className="h-0.5 w-full bg-surface-2">
            <div
              className="h-full bg-accent transition-[width] duration-500 ease-out"
              style={{ width: `${progress * 100}%` }}
            />
          </div>

          <div className="grid gap-px bg-line sm:grid-cols-2">
            {/* Left: the steps, lighting up in order. */}
            <ol className="space-y-1 bg-surface-2 p-5">
              {run.steps.map((step, index) => {
                const state =
                  index < stepIndex ? "done" : index === stepIndex ? "active" : "waiting";

                return (
                  <li
                    key={`${run.agent}-${step.label}`}
                    className={cn(
                      "flex items-start gap-3 rounded-lg px-2.5 py-2.5 transition-all duration-500",
                      state === "active" && "bg-accent/10",
                      state === "waiting" && "opacity-35",
                    )}
                  >
                    <span className="mt-0.5 shrink-0">
                      {state === "done" ? (
                        <Check className="size-4 text-live" strokeWidth={3} />
                      ) : state === "active" ? (
                        <Loader2 className="size-4 animate-spin text-accent" />
                      ) : (
                        <span className="block size-4 rounded-full border border-line-strong" />
                      )}
                    </span>

                    <span className="min-w-0">
                      <span
                        className={cn(
                          "block text-sm font-medium transition-colors",
                          state === "waiting" ? "text-muted" : "text-fg",
                        )}
                      >
                        {step.label}
                      </span>
                      <span
                        className={cn(
                          "block text-xs transition-opacity duration-500",
                          state === "waiting" ? "opacity-0" : "text-muted opacity-100",
                        )}
                      >
                        {step.detail}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ol>

            {/* Right: what it produced. Appears only once the work is done. */}
            <div className="bg-surface-2 p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-faint">
                Output
              </p>

              <div className="mt-3 space-y-2.5">
                {run.output.map((item, index) => (
                  <div
                    key={`${run.agent}-${item.kind}-${index}`}
                    className={cn(
                      "rounded-lg border border-line bg-surface-2 p-3 transition-all duration-500",
                      done
                        ? "translate-y-0 opacity-100"
                        : "pointer-events-none translate-y-2 opacity-0",
                    )}
                    style={{ transitionDelay: done ? `${index * 110}ms` : "0ms" }}
                  >
                    <span
                      className={cn(
                        "text-[10px] font-bold uppercase tracking-wider",
                        item.kind === "Flagged" ? "text-money" : "text-accent",
                      )}
                    >
                      {item.kind}
                    </span>
                    <p className="mt-1 text-[13px] leading-relaxed text-muted">
                      {item.text}
                    </p>
                  </div>
                ))}
              </div>

              <p
                className={cn(
                  "mt-4 border-t border-line pt-3 text-xs font-medium text-live transition-opacity duration-500",
                  done ? "opacity-100" : "opacity-0",
                )}
              >
                {run.saved}
              </p>
            </div>
          </div>
        </div>

        {/* Which agent is showing, and a way to jump. */}
        <div className="mt-6 flex items-center justify-center gap-2">
          {RUNS.map((item, index) => (
            <button
              key={item.agent}
              type="button"
              onClick={() => {
                setRunIndex(index);
                setStepIndex(-1);
              }}
              aria-label={`Show ${item.agent}`}
              aria-current={index === runIndex}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                index === runIndex
                  ? "w-8 bg-accent"
                  : "w-1.5 bg-surface-3 hover:bg-surface-3",
              )}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
