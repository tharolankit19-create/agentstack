"use client";

import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The roadmap.
 *
 * The unspoken objection at this point is "this sounds like a project". So the
 * whole section exists to show the distance between signing up and a working
 * agent, with honest times attached — including the two steps that are
 * genuinely instant, because a roadmap where every step claims "instant" is
 * one nobody believes.
 *
 * The line fills as you scroll and the steps tick over in sequence. The
 * animation is the argument: it is over before you finish reading it.
 */

const STEPS: { title: string; body: string; time: string }[] = [
  {
    title: "Sign up",
    body: "Email and a password, or one click with Google. No card.",
    time: "20 seconds",
  },
  {
    title: "Tell us what hurts",
    body: "Four questions. We use the answers to order your library, not to email you.",
    time: "40 seconds",
  },
  {
    title: "Pick your first agent",
    body: "From 25, sorted by what you said you pay for. Fill in a URL, a tone, and your OpenAI key.",
    time: "2 minutes",
  },
  {
    title: "Click Deploy",
    body: "It builds, goes live on its own URL, and runs on its schedule from that morning on.",
    time: "90 seconds",
  },
  {
    title: "Cancel the tool it replaced",
    body: "The part that pays for this. Then do it again with the next one.",
    time: "your favourite part",
  },
];

export function Roadmap() {
  const containerRef = useRef<HTMLOListElement>(null);
  const [reached, setReached] = useState(-1);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const items = Array.from(container.querySelectorAll("[data-step]"));

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setReached(items.length - 1);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const index = Number((entry.target as HTMLElement).dataset.step);
          // Only ever moves forward, so scrolling back up does not rewind it.
          setReached((current) => Math.max(current, index));
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -25% 0px", threshold: 0.4 },
    );

    for (const item of items) observer.observe(item);
    return () => observer.disconnect();
  }, []);

  const progress = ((reached + 1) / STEPS.length) * 100;

  return (
    <section className="border-b border-[var(--color-line)] bg-[var(--color-paper-soft)] px-5 py-16 sm:py-24">
      <div className="mx-auto max-w-3xl">
        <h2 className="text-3xl font-extrabold sm:text-5xl">
          Signup to a working agent:
          <br />
          <span className="text-[var(--color-accent)]">about four minutes.</span>
        </h2>
        <p className="mt-4 max-w-xl text-lg text-[var(--color-ink-soft)]">
          Not a trial you have to schedule. Not an onboarding call. Here is the
          entire distance, with real times on it.
        </p>

        <ol ref={containerRef} className="relative mt-14 space-y-9">
          {/* The rail, and the violet fill that chases you down it. */}
          <div
            aria-hidden
            className="absolute left-[15px] top-2 h-[calc(100%-1rem)] w-0.5 bg-[var(--color-line)]"
          >
            <div
              className="w-full bg-[var(--color-accent)] transition-[height] duration-700 ease-out"
              style={{ height: `${progress}%` }}
            />
          </div>

          {STEPS.map((step, index) => {
            const done = index <= reached;
            return (
              <li
                key={step.title}
                data-step={index}
                className="relative flex gap-5 pl-0"
              >
                <span
                  className={cn(
                    "relative z-10 mt-0.5 grid size-8 shrink-0 place-items-center rounded-full border-2 text-sm font-bold transition-all duration-500",
                    done
                      ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-white"
                      : "border-[var(--color-line)] bg-white text-[var(--color-ink-faint)]",
                  )}
                >
                  {done ? <Check className="size-4" strokeWidth={3} /> : index + 1}
                </span>

                <div
                  className={cn(
                    "min-w-0 flex-1 transition-all duration-500",
                    done ? "opacity-100" : "opacity-55",
                  )}
                  style={{ transform: done ? "none" : "translateY(4px)" }}
                >
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h3 className="text-lg font-bold">{step.title}</h3>
                    <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-bold text-[var(--color-ink-soft)] ring-1 ring-[var(--color-line)]">
                      {step.time}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-[var(--color-ink-soft)]">
                    {step.body}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>

        <p className="mt-12 rounded-2xl border border-[var(--color-line)] bg-white p-6 text-[15px] leading-relaxed text-[var(--color-ink-soft)]">
          <span className="font-semibold text-[var(--color-ink)]">
            Steps one and two are free and take a minute.
          </span>{" "}
          You see all 25 agents, your suggested stack, and what each one saves you
          before anything asks for a card.
        </p>
      </div>
    </section>
  );
}
