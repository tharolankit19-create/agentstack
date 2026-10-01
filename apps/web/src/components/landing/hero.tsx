import Link from "next/link";
import { ArrowRight, Download, Play } from "lucide-react";

const EXAMPLES = [
  "Find 20 founders I should talk to and prepare outreach.",
  "Check what changed in my market this morning.",
  "Handle today's content research and bring me drafts.",
] as const;

export function Hero() {
  return (
    <section className="border-b border-line px-5 pt-24 sm:pt-28">
      <div className="mx-auto grid min-h-[82svh] max-w-7xl items-center gap-12 py-14 lg:grid-cols-[1.08fr_.92fr] lg:py-20">
        <div className="max-w-3xl">
          <p className="microlabel">Kryx · the founder&apos;s agent army</p>

          <h1 className="mt-5 text-[54px] font-extrabold leading-[.94] tracking-[-.065em] text-fg-strong sm:text-[76px] lg:text-[88px]">
            You run the company.
            <span className="block">Kryx runs the busywork.</span>
          </h1>

          <p className="mt-6 max-w-[680px] text-[17px] leading-8 text-muted sm:text-[19px]">
            Give Kryx a goal. It researches, plans, works across your tools and
            devices, asks when a decision is yours, and brings back finished
            work instead of another chat transcript.
          </p>

          <div className="mt-8 flex flex-col gap-2.5 sm:flex-row">
            <Link
              href="/login?mode=signup"
              className="kryx-button kryx-button-primary h-14 justify-center px-7 text-[15px] sm:text-base"
            >
              Start with 100 free credits <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/download"
              className="inline-flex h-14 items-center justify-center gap-2 rounded-xl border border-line bg-surface px-6 text-[15px] font-extrabold text-fg-strong transition hover:bg-surface-2"
            >
              <Download className="size-[17px]" /> Download Kryx
            </Link>
          </div>

          <p className="mt-4 text-sm text-faint">
            No workflow builder. No agent setup screen. No monthly seat fee.
          </p>
        </div>

        <div className="overflow-hidden rounded-[24px] border border-line bg-surface shadow-[var(--shadow)]">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div>
              <p className="text-sm font-extrabold text-fg-strong">Give Kryx a job</p>
              <p className="text-xs text-faint">Example mission</p>
            </div>
            <span className="rounded-full border border-line bg-surface-2 px-2.5 py-1 text-[11px] font-bold text-muted">
              Auto chooses cloud or device
            </span>
          </div>

          <div className="p-4 sm:p-5">
            <div className="rounded-2xl border border-line bg-bg p-4">
              <p className="text-[15px] leading-6 text-fg-strong">
                Find 20 SaaS founders who could need Kryx, qualify them, and
                prepare personalized outreach.
              </p>
              <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
                <span className="text-xs text-faint">Kryx will ask before anything sends.</span>
                <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-accent">
                  <Play className="size-3.5" /> Run
                </span>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {[
                ["Research the market", "done"],
                ["Find and qualify founders", "working"],
                ["Prepare outreach", "next"],
                ["Quality check", "next"],
              ].map(([label, state], index) => (
                <div
                  key={label}
                  className="flex items-center gap-3 rounded-xl border border-line bg-surface-2 px-3.5 py-3"
                >
                  <span className="grid size-6 place-items-center rounded-full border border-line bg-surface font-mono text-[10px] font-bold text-faint">
                    {index + 1}
                  </span>
                  <span className="flex-1 text-sm font-semibold text-fg-strong">{label}</span>
                  <span className={`text-xs font-bold ${state === "working" ? "text-accent" : "text-faint"}`}>
                    {state}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-5 border-t border-line pt-4">
              <p className="text-xs font-bold uppercase tracking-[.08em] text-faint">Try asking</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {EXAMPLES.map((example) => (
                  <span
                    key={example}
                    className="rounded-lg border border-line bg-surface-2 px-2.5 py-2 text-xs leading-5 text-muted"
                  >
                    {example}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
