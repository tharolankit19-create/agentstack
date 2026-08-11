import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";

/**
 * Today, this week, this month — each against the period before it.
 *
 * A single 30-day total answers "did anything happen" and nothing else. The
 * question a founder actually has is whether it is going up, and that needs a
 * comparison, so every figure here carries the previous period next to it.
 *
 * Two decisions worth stating:
 *
 *   - **No percentage on a small base.** Going from 1 to 3 is not "+200%", it
 *     is two more things. Percentages on single-digit counts are the most
 *     common way a dashboard lies without technically being wrong, so below a
 *     threshold this shows the raw difference instead.
 *   - **Flat is not failure.** A period with no change renders neutral, not
 *     red. Most weeks are flat and colouring them like a problem trains people
 *     to ignore the colour.
 */

export interface PeriodStat {
  label: string;
  current: number;
  previous: number;
  /** What the previous period was, in words: "yesterday", "last week". */
  against: string;
}

/** Below this, a percentage is noise dressed as a signal. */
const MIN_BASE_FOR_PERCENT = 5;

export function ProgressRollup({ periods }: { periods: PeriodStat[] }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-3">
      {periods.map((period) => {
        const delta = period.current - period.previous;
        const usePercent = period.previous >= MIN_BASE_FOR_PERCENT;
        const percent = usePercent
          ? Math.round((delta / period.previous) * 100)
          : null;

        const direction = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
        const tone =
          direction === "up"
            ? "text-live"
            : direction === "down"
              ? "text-money"
              : "text-faint";

        const Icon =
          direction === "up" ? ArrowUp : direction === "down" ? ArrowDown : ArrowRight;

        return (
          <div key={period.label} className="rounded-xl border border-line p-4">
            <dt className="text-xs text-muted">{period.label}</dt>
            <dd className="mt-1 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold tabular-nums text-fg-strong">
                {period.current}
              </span>
              <span
                className={`inline-flex items-center gap-0.5 text-sm font-bold tabular-nums ${tone}`}
              >
                <Icon className="size-3.5" aria-hidden />
                {direction === "flat"
                  ? "same"
                  : percent !== null
                    ? `${Math.abs(percent)}%`
                    : Math.abs(delta)}
              </span>
            </dd>
            <p className="mt-1 text-xs text-faint">
              {period.previous} {period.against}
            </p>
          </div>
        );
      })}
    </dl>
  );
}
