"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2, Send } from "lucide-react";
import { HEAD_AGENT, SQUADS } from "@/lib/army";
import { AgentAvatar } from "@/components/ui/agent-avatar";
import { cn } from "@/lib/utils";

/**
 * The army, running, as a node graph.
 *
 * This is the section the whole page is built around, so three rules kept it
 * from turning into a screensaver:
 *
 *   1. **The graph is the real one.** Nodes are the actual squads from
 *      `army.ts`, in the order they actually run — fan out to six squads, then
 *      fan back in to the head agent, then one message. Nothing invented to
 *      fill space.
 *   2. **It ends in an outcome, not an animation.** The last beat is the
 *      Telegram message a founder would actually receive, because that is the
 *      product. A workflow diagram that loops forever without producing
 *      anything is a diagram of a product that does not.
 *   3. **It stops when nobody is watching.** An IntersectionObserver pauses
 *      the timers off-screen, and `prefers-reduced-motion` gets the finished
 *      state rather than a broken one.
 */

/** How long each squad appears to work. Uneven on purpose — real work is. */
const SQUAD_MS = [1500, 1300, 1100, 1400, 1700, 1200];
const COMPILE_MS = 1600;
const HOLD_MS = 5200;

type Phase = "idle" | "working" | "compiling" | "sent";

/** The message at the end. Concrete numbers, because vague ones persuade nobody. */
const BRIEFING = [
  { label: "Research", text: "3 threads about onboarding friction. That is your angle." },
  { label: "Content", text: "5 posts drafted, hooks rewritten twice." },
  { label: "Intel", text: "Northwind dropped their starter tier to $19." },
  { label: "Outreach", text: "12 leads scored 8+, emails written." },
  { label: "Reputation", text: "2 replies ready. One 2-star needs you." },
];

export function ArmyFlow() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [step, setStep] = useState(-1);

  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0.2 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const total = SQUADS.length;

  useEffect(() => {
    if (reduced) {
      setStep(total + 1);
      return;
    }
    if (!visible) return;

    // Past the end: hold on the delivered message, then start over.
    if (step > total) {
      const timer = setTimeout(() => setStep(-1), HOLD_MS);
      return () => clearTimeout(timer);
    }

    const delay =
      step < 0 ? 600 : step === total ? COMPILE_MS : (SQUAD_MS[step] ?? 1300);
    const timer = setTimeout(() => setStep((current) => current + 1), delay);
    return () => clearTimeout(timer);
  }, [visible, reduced, step, total]);

  const phase: Phase = useMemo(() => {
    if (step < 0) return "idle";
    if (step < total) return "working";
    if (step === total) return "compiling";
    return "sent";
  }, [step, total]);

  return (
    <section className="grid-field relative border-b border-line px-5 py-16 sm:py-24">
      <div ref={containerRef} className="relative mx-auto max-w-5xl">
        <div className="text-center">
          <p className="microlabel">Every morning, before you wake up</p>
          <h2 className="mt-4 text-3xl font-extrabold leading-tight text-fg-strong sm:text-5xl">
            Six squads run.
            <br />
            One message arrives.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted">
            No canvas to wire, no nodes to drag. This is the workflow, and it is
            already built.
          </p>
        </div>

        <div className="mt-12 overflow-hidden rounded-2xl border border-line bg-surface-2 shadow-2xl">
          {/* Trigger node. */}
          <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
            <span className="grid size-7 place-items-center rounded-lg bg-accent text-xs font-black text-accent-fg">
              ⏱
            </span>
            <span className="font-bold text-fg-strong">Daily trigger</span>
            <span className="rounded-full bg-surface-3 px-2.5 py-1 text-xs font-medium text-muted">
              09:00 · your timezone
            </span>
            <span className="ml-auto flex items-center gap-2 text-xs font-medium text-muted">
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  phase === "sent" ? "bg-live" : "bg-money",
                  phase !== "sent" && !reduced && "motion-safe:animate-pulse",
                )}
              />
              {phase === "sent" ? "delivered" : "running"}
            </span>
          </div>

          <div className="grid gap-px bg-line lg:grid-cols-[1.35fr_1fr]">
            {/* Left: the squads, lighting up as they run. */}
            <div className="bg-surface-2 p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-faint">
                Squads
              </p>

              <ol className="mt-3 space-y-2">
                {SQUADS.map((squad, index) => {
                  const state =
                    step > index ? "done" : step === index ? "active" : "waiting";

                  return (
                    <li
                      key={squad.id}
                      className={cn(
                        "rounded-xl border px-3.5 py-3 transition-all duration-500",
                        state === "active"
                          ? "border-money/50 bg-[var(--money-wash)]"
                          : state === "done"
                            ? "border-line bg-surface"
                            : "border-line opacity-40",
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <AgentAvatar name={squad.name} seed={squad.id} size={28} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-bold text-fg-strong">
                            {squad.name}
                          </span>
                          <span className="block truncate text-xs text-muted">
                            {squad.mission}
                          </span>
                        </span>
                        <span className="shrink-0">
                          {state === "done" ? (
                            <Check className="size-4 text-live" strokeWidth={3} />
                          ) : state === "active" ? (
                            <Loader2 className="size-4 animate-spin text-money" />
                          ) : (
                            <span className="block size-4 rounded-full border border-line-strong" />
                          )}
                        </span>
                      </div>

                      {/* The pipeline inside the squad, revealed while it works. */}
                      <div
                        className={cn(
                          "grid transition-all duration-500",
                          state === "waiting"
                            ? "grid-rows-[0fr] opacity-0"
                            : "mt-2 grid-rows-[1fr] opacity-100",
                        )}
                      >
                        <div className="overflow-hidden">
                          <div className="flex flex-wrap items-center gap-1.5 pl-8">
                            {squad.pipeline.map((sub, subIndex) => (
                              <span
                                key={sub.name}
                                className="flex items-center gap-1.5 text-[11px] text-muted"
                              >
                                {subIndex > 0 ? (
                                  <span className="text-faint">→</span>
                                ) : null}
                                <span className="flex items-center gap-1.5 rounded-full border border-line bg-surface-2 py-0.5 pl-0.5 pr-2 font-medium">
                                  <AgentAvatar
                                    name={sub.defaultName ?? sub.name}
                                    seed={sub.templateId ?? sub.name}
                                    size={16}
                                  />
                                  {sub.defaultName ?? sub.name}
                                </span>
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>

            {/* Right: the head agent, then the message it sends. */}
            <div className="flex flex-col bg-surface-2 p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-faint">
                Head agent
              </p>

              <div
                className={cn(
                  "mt-3 rounded-xl border px-4 py-3 transition-all duration-500",
                  phase === "compiling"
                    ? "border-accent bg-[var(--accent-wash)]"
                    : phase === "sent"
                      ? "border-line bg-surface"
                      : "border-line opacity-40",
                )}
              >
                <p className="flex items-center gap-2 text-sm font-bold text-fg-strong">
                  <AgentAvatar
                    name={HEAD_AGENT.defaultName}
                    seed={HEAD_AGENT.id}
                    size={22}
                    commander
                  />
                  {HEAD_AGENT.defaultName}
                  {phase === "compiling" ? (
                    <Loader2 className="ml-auto size-3.5 animate-spin text-accent" />
                  ) : phase === "sent" ? (
                    <Check className="ml-auto size-3.5 text-live" strokeWidth={3} />
                  ) : null}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  {phase === "compiling"
                    ? "Reading six outputs, dropping what does not matter…"
                    : "Compiles everything into one briefing."}
                </p>
              </div>

              {/* The outcome. The point of the whole diagram. */}
              <div
                className={cn(
                  "mt-4 flex-1 rounded-xl border border-line bg-surface p-4 transition-all duration-700",
                  phase === "sent"
                    ? "translate-y-0 opacity-100"
                    : "pointer-events-none translate-y-2 opacity-0",
                )}
              >
                <p className="flex items-center gap-2 text-xs font-bold text-live">
                  <Send className="size-3.5" aria-hidden />
                  Telegram · 9:00am
                </p>

                <p className="mt-2.5 text-[13px] font-semibold text-fg-strong">
                  Morning. Here is today.
                </p>

                <ul className="mt-2 space-y-1.5">
                  {BRIEFING.map((line, index) => (
                    <li
                      key={line.label}
                      className="text-[12px] leading-relaxed text-muted transition-all duration-500"
                      style={{
                        transitionDelay: phase === "sent" ? `${index * 90}ms` : "0ms",
                        opacity: phase === "sent" ? 1 : 0,
                      }}
                    >
                      <span className="font-semibold text-fg">{line.label}:</span>{" "}
                      {line.text}
                    </li>
                  ))}
                </ul>

                <p className="mt-3 border-t border-line pt-2.5 text-[12px] text-muted">
                  Reply <span className="font-bold text-fg">1</span> to approve
                  all · <span className="font-bold text-fg">2</span> for detail ·{" "}
                  <span className="font-bold text-fg">skip</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        <p className="mt-5 text-center text-sm text-faint">
          Nothing publishes, sends, or spends until you reply. Every run is
          logged.
        </p>
      </div>
    </section>
  );
}
