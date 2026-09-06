import Link from "next/link";
import { ArrowRight, Check, Clock3, Command, Search, Sparkles } from "lucide-react";
import { HEAD_AGENT, totalAgentCount } from "@/lib/army";

const EVENTS = [
  { icon: Search, agent: "Argus", text: "Competitor pricing changed", meta: "checked 3 sites · receipt saved" },
  { icon: Sparkles, agent: "Otis", text: "Launch thread drafted", meta: "ready for your approval" },
  { icon: Check, agent: "Wren", text: "Homepage SEO audit finished", meta: "7 fixes ranked by impact" },
];

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-line px-5 pb-20 pt-14 sm:pb-28 sm:pt-20">
      <div className="hero-orbit" aria-hidden />
      <div className="relative mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-16">
        <div>
          <p className="microlabel flex items-center gap-2">
            <span className="size-2 rounded-full bg-live shadow-[var(--money-glow)]" />
            Your marketing operation, always on
          </p>
          <h1 className="mt-5 max-w-2xl text-[48px] leading-[0.94] tracking-[-0.055em] sm:text-[72px]">
            Wake up to work already done.
          </h1>
          <p className="mt-7 max-w-xl text-[18px] leading-relaxed text-muted sm:text-[20px]">
            Tell one head agent what you need. It routes the job to a specialist,
            uses your connected tools, runs it on schedule, and brings back a
            finished deliverable—not another long AI conversation.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/login?mode=signup"
              className="group inline-flex h-14 items-center justify-center gap-2.5 rounded-xl bg-accent px-7 text-[16px] font-bold text-accent-fg shadow-[0_12px_34px_-14px_var(--accent)] transition hover:-translate-y-0.5"
            >
              Start my agent army
              <ArrowRight className="size-5 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/demo"
              className="inline-flex h-14 items-center justify-center rounded-xl border border-line-strong bg-surface/70 px-6 text-[16px] font-semibold text-fg backdrop-blur transition hover:bg-surface-2"
            >
              Explore the command center
            </Link>
          </div>

          <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
            <span>No credit card</span>
            <span>{totalAgentCount() - 1} specialists included</span>
            <span>No API key for testing</span>
          </div>
        </div>

        <CommandPreview />
      </div>
    </section>
  );
}

function CommandPreview() {
  return (
    <div className="relative rounded-[22px] border border-line-strong bg-surface/95 p-2 shadow-[var(--shadow-lg)]">
      <div className="rounded-2xl border border-line bg-bg-deep">
        <div className="flex items-center justify-between border-b border-line px-4 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-lg bg-accent text-accent-fg">
              <Command className="size-4" />
            </span>
            <div>
              <p className="text-sm font-bold text-fg-strong">Command center</p>
              <p className="text-xs text-faint">{HEAD_AGENT.defaultName} + {totalAgentCount() - 1} specialists</p>
            </div>
          </div>
          <span className="rounded-full border border-live/30 bg-[var(--live-wash)] px-2.5 py-1 text-[11px] font-bold text-live">
            3 working
          </span>
        </div>

        <div className="grid min-h-[430px] sm:grid-cols-[1fr_155px]">
          <div className="p-4 sm:p-5">
            <div className="rounded-2xl rounded-br-md bg-accent px-4 py-3 text-[14px] leading-relaxed text-accent-fg">
              Audit our homepage, check what our top 3 competitors changed, and
              draft a launch thread for tomorrow at 9 AM.
            </div>
            <p className="mt-3 text-[12px] font-semibold uppercase tracking-[0.14em] text-faint">
              {HEAD_AGENT.defaultName} routed 3 jobs
            </p>

            <div className="mt-3 space-y-2.5">
              {EVENTS.map(({ icon: Icon, agent, text, meta }) => (
                <div key={agent} className="rounded-xl border border-line bg-surface-2 p-3.5">
                  <div className="flex items-start gap-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-line bg-surface text-muted">
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-bold text-fg-strong">{agent} · {text}</p>
                      <p className="mt-0.5 text-[12px] text-muted">{meta}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 flex items-center gap-2 rounded-xl border border-line bg-surface px-3.5 py-3 text-[13px] text-muted">
              <Clock3 className="size-4 text-accent" />
              Launch thread scheduled · tomorrow, 9:00 AM
            </div>
          </div>

          <aside className="hidden border-l border-line p-4 sm:block">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-faint">Today</p>
            <dl className="mt-4 space-y-5">
              <Metric value="8" label="jobs done" />
              <Metric value="3" label="in progress" />
              <Metric value="2" label="need you" accent />
              <Metric value="11" label="tool calls" />
            </dl>
            <div className="mt-6 border-t border-line pt-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-faint">Next brief</p>
              <p className="mt-2 text-sm font-bold text-fg-strong">Tomorrow · 8:00</p>
              <p className="mt-1 text-xs leading-relaxed text-muted">Results, blockers, and the one decision that matters.</p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Metric({ value, label, accent = false }: { value: string; label: string; accent?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={`tnum mt-0.5 text-2xl font-bold ${accent ? "text-accent" : "text-fg-strong"}`}>{value}</dd>
    </div>
  );
}
