import Link from "next/link";
import { CheckCircle2, FileText, Radar, Sunrise, Sparkles } from "lucide-react";
import type { Generation } from "@/lib/supabase/types";

/**
 * Today's work, in one glance.
 *
 * The founder is not technical and does not want a log. They want the answer to
 * one question when they open the dashboard: "what did my army get done today,
 * and is anything waiting on me?" This is that answer — a single card, four
 * plain tiles, and one button that goes to the things needing approval. No
 * jargon, no per-agent breakdown, no graph. Just: here is today.
 */

interface Bucket {
  key: string;
  label: string;
  icon: React.ReactNode;
  count: number;
  /** Drafts waiting on the founder get the accent; the rest are just done. */
  needsYou?: boolean;
}

export function TodayCard({
  todays,
  pending,
  headId,
}: {
  todays: Pick<Generation, "kind">[];
  pending: number;
  headId: string | null;
}) {
  const by = (test: (k: string) => boolean) =>
    todays.filter((g) => test(g.kind)).length;

  const drafts = by((k) => k === "tweet" || k === "linkedin" || k === "post" || k === "draft");
  const alerts = by((k) => k === "alert");
  const briefings = by((k) => k === "briefing");
  const tasks = by((k) => k === "note");

  const total = todays.length;

  const buckets: Bucket[] = [
    {
      key: "drafts",
      label: pending > 0 ? "waiting for you" : "drafts written",
      icon: <FileText className="size-4" />,
      count: pending > 0 ? pending : drafts,
      needsYou: pending > 0,
    },
    { key: "alerts", label: "market alerts", icon: <Radar className="size-4" />, count: alerts },
    { key: "briefings", label: "briefings sent", icon: <Sunrise className="size-4" />, count: briefings },
    { key: "tasks", label: "tasks done", icon: <CheckCircle2 className="size-4" />, count: tasks },
  ];

  return (
    <section className="overflow-hidden rounded-2xl border border-line-strong bg-surface-2 shadow-[var(--shadow)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-faint">Today</p>
          <h2 className="mt-0.5 text-lg font-extrabold text-fg-strong">
            {total > 0 ? "Here's what your army got done" : "Your army is warming up"}
          </h2>
        </div>
        {pending > 0 && headId ? (
          <Link
            href={`/dashboard/agents/${headId}/chat`}
            className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-3.5 py-2 text-sm font-bold text-accent-fg transition-colors hover:bg-accent-hover"
          >
            <Sparkles className="size-4" />
            Review {pending}
          </Link>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-px bg-line sm:grid-cols-4">
        {buckets.map((bucket) => (
          <div
            key={bucket.key}
            className="flex flex-col gap-1 bg-surface-2 px-5 py-4"
          >
            <span
              className={
                bucket.needsYou && bucket.count > 0
                  ? "flex size-8 items-center justify-center rounded-lg bg-[var(--money-wash)] text-money"
                  : "flex size-8 items-center justify-center rounded-lg bg-surface-3 text-muted"
              }
              aria-hidden
            >
              {bucket.icon}
            </span>
            <span className="mt-1 text-2xl font-extrabold tabular-nums text-fg-strong">
              {bucket.count}
            </span>
            <span className="text-xs font-medium text-muted">{bucket.label}</span>
          </div>
        ))}
      </div>

      {total === 0 ? (
        <p className="border-t border-line px-5 py-3 text-xs leading-relaxed text-faint">
          Nothing yet today. Your agents run on a schedule and drop everything they
          make right here — the first drafts and briefings land automatically.
        </p>
      ) : null}
    </section>
  );
}
