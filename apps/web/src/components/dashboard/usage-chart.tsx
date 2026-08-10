/**
 * Thirty days of output, as bars.
 *
 * Plain SVG rather than a charting library: this is one series of thirty
 * integers, and pulling in a runtime to draw it would cost more kilobytes than
 * the rest of the page. It also stays a server component that way, so the
 * numbers arrive already rendered.
 *
 * Bars are labelled through `title` and the whole thing has a table-shaped
 * description underneath for screen readers, because a chart nobody can read
 * is decoration.
 */
export function UsageChart({
  series,
}: {
  series: { day: string; count: number }[];
}) {
  const max = Math.max(...series.map((point) => point.count), 1);
  const total = series.reduce((sum, point) => sum + point.count, 0);
  const busiest = series.reduce((best, point) =>
    point.count > best.count ? point : best,
  );

  return (
    <figure className="rounded-2xl border border-line bg-surface-2 p-5">
      <div
        className="flex h-32 items-end gap-[3px]"
        role="img"
        aria-label={`Output per day over the last 30 days. ${total} in total, busiest day ${formatDay(busiest.day)} with ${busiest.count}.`}
      >
        {series.map((point) => {
          // A day with output always gets a visible sliver, so "one thing
          // happened" never looks identical to "nothing happened".
          const height = point.count === 0 ? 2 : Math.max((point.count / max) * 100, 8);
          return (
            <div
              key={point.day}
              className="flex-1"
              title={`${formatDay(point.day)}: ${point.count}`}
            >
              <div
                className={
                  point.count === 0
                    ? "w-full rounded-sm bg-surface-3"
                    : "w-full rounded-sm bg-live"
                }
                style={{ height: `${height}%` }}
              />
            </div>
          );
        })}
      </div>

      <figcaption className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <span>{formatDay(series[0]?.day ?? "")}</span>
        <span className="font-semibold text-fg">
          {total} produced in 30 days
        </span>
        <span>Today</span>
      </figcaption>
    </figure>
  );
}

function formatDay(day: string): string {
  if (!day) return "";
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}
