/**
 * How often an agent should actually work.
 *
 * Every template already declares its own rhythm as a cron expression — the SEO
 * agent audits on Monday mornings, the review agent checks every six hours, the
 * content agent writes on weekdays. That rhythm was being thrown away: the
 * squad worker ran every agent at most once per calendar day, so the review
 * agent went from four times a day to one, and the weekly agents produced an
 * audit every single morning whether anything had changed or not. Founders got
 * a pile of near-identical drafts and stopped opening them.
 *
 * This turns the declared expression into an interval, which the worker then
 * measures against when the agent last ran. Deliberately an interval and not a
 * calendar: an agent whose slot is missed because the model was slow or the
 * deploy was down should do its job late, not skip the week. Anything that
 * genuinely has to land at a wall-clock time — the morning briefing, "at 5pm do
 * X" — has its own timezone-aware path and does not come through here.
 */

/** How many distinct values a cron field selects out of its range. */
function countValues(field: string, min: number, max: number): number {
  const span = max - min + 1;
  if (!field || field === "*") return span;

  let total = 0;
  for (const part of field.split(",")) {
    const [range, stepRaw] = part.split("/");
    const step = stepRaw ? Math.max(1, Number(stepRaw)) : 1;
    if (!Number.isFinite(step)) return span;

    let width: number;
    if (!range || range === "*") {
      width = span;
    } else if (range.includes("-")) {
      const [lo, hi] = range.split("-").map(Number);
      if (!Number.isFinite(lo) || !Number.isFinite(hi)) return span;
      // Wrap-around ranges ("5-1") are legal cron; treat them by their length.
      width = hi >= lo ? hi - lo + 1 : span - (lo - hi) + 1;
    } else {
      width = Number.isFinite(Number(range)) ? 1 : span;
    }

    total += Math.max(1, Math.ceil(width / step));
  }

  // A malformed field must never make an agent run every minute. Cap at the
  // real span so the worst case is the honest maximum, not an accidental flood.
  return Math.min(Math.max(total, 1), span);
}

/** A week, in minutes — the window everything is averaged over. */
const WEEK_MINUTES = 7 * 24 * 60;

/** One morning run in the founder's timezone, including a missed morning slot. */
export function morningDue(lastRunAt: string | null, timezone: string, time: string, now = new Date()): boolean {
  try {
    const date = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" });
    const clock = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    const target = /^\d{2}:\d{2}$/.test(time) ? time : "08:00";
    if (clock.format(now) < target) return false;
    return !lastRunAt || date.format(new Date(lastRunAt)) !== date.format(now);
  } catch { return isDue("0 8 * * *", lastRunAt); }
}

/** Nothing runs more than once an hour through this path, whatever it claims. */
const FLOOR_MINUTES = 60;

/** And nothing waits more than a month, so a typo cannot silence an agent. */
const CEILING_MINUTES = 31 * 24 * 60;

/**
 * The average gap between firings of a five-field cron expression.
 *
 * Averaged rather than exact on purpose. "0 9 * * 1-5" fires five times a week
 * at uneven spacing; treating that as "roughly every 34 hours" keeps the agent
 * producing at the right volume without pinning it to a clock it has no reason
 * to care about. Falls back to daily for anything it cannot read, which is the
 * safe direction: an agent that works slightly too often is noise, one that
 * never works is a refund.
 */
export function intervalMinutes(frequency: string | undefined): number {
  const fields = (frequency ?? "").trim().split(/\s+/);
  if (fields.length !== 5) return 24 * 60;

  const [minute, hour, dom, , dow] = fields;

  const perDay = countValues(minute, 0, 59) * countValues(hour, 0, 23);

  // Cron's oddest rule: when day-of-month and day-of-week are *both* restricted
  // they are OR'd, not AND'd — the expression fires on either. When only one is
  // restricted, that one alone decides, and the unrestricted field contributes
  // nothing. Reading "*" as "all seven days" in that second case is what made a
  // monthly expression like "0 0 1 * *" look daily.
  const dowSet = dow !== "*";
  const domSet = dom !== "*";
  const byWeekday = countValues(dow, 0, 6);
  const byMonthday = (countValues(dom, 1, 31) / 30.4) * 7;

  let perWeekDays: number;
  if (!dowSet && !domSet) perWeekDays = 7;
  else if (dowSet && domSet) perWeekDays = Math.max(byWeekday, byMonthday);
  else if (dowSet) perWeekDays = byWeekday;
  else perWeekDays = byMonthday;

  const firingsPerWeek = Math.max(perDay * perWeekDays, 1 / 4.4);

  return Math.min(
    CEILING_MINUTES,
    Math.max(FLOOR_MINUTES, Math.round(WEEK_MINUTES / firingsPerWeek)),
  );
}

/**
 * Whether an agent's turn has come round again.
 *
 * A null `lastRunAt` is due — a newly created agent should do its job on the
 * next tick, not sit idle until a week has passed. That first run is also the
 * founder's first proof that any of this works.
 */
export function isDue(frequency: string | undefined, lastRunAt: string | null): boolean {
  if (!lastRunAt) return true;

  const last = Date.parse(lastRunAt);
  if (!Number.isFinite(last)) return true;

  return Date.now() - last >= intervalMinutes(frequency) * 60_000;
}

/** "every 4 hours", "weekly" — for the dashboard, so a founder can see the rhythm. */
export function cadenceLabel(frequency: string | undefined): string {
  const minutes = intervalMinutes(frequency);
  if (minutes < 24 * 60) {
    const hours = Math.round(minutes / 60);
    return hours <= 1 ? "hourly" : `every ${hours} hours`;
  }
  const days = Math.round(minutes / (24 * 60));
  if (days <= 1) return "daily";
  if (days >= 6 && days <= 8) return "weekly";
  if (days >= 13 && days <= 16) return "fortnightly";
  if (days >= 28) return "monthly";
  return `every ${days} days`;
}
