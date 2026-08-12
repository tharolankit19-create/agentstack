/**
 * Reading "at 5pm, write the launch post and message me" out of plain text.
 *
 * Deliberately deterministic, not a model call. A founder who types a time
 * wants that exact time, and a model that "usually" parses times right is the
 * one thing you cannot ship for scheduling — the failure is invisible until
 * 5pm comes and nothing happens. So this handles the handful of ways people
 * actually write times and returns null for everything else, which is the
 * honest answer: no time, no schedule.
 *
 * Times are interpreted in the founder's own timezone and returned as UTC.
 */

/** Minutes east of UTC for the zones the head agent offers. DST-approximate. */
const TZ_OFFSETS: Record<string, number> = {
  UTC: 0,
  "Asia/Kolkata": 330,
  "Asia/Dubai": 240,
  "Asia/Singapore": 480,
  "Europe/London": 0,
  "Europe/Berlin": 60,
  "America/New_York": -300,
  "America/Chicago": -360,
  "America/Los_Angeles": -480,
  "Australia/Sydney": 660,
};

export interface ParsedSchedule {
  /** When to run, in UTC. */
  runAt: Date;
  /** How the founder said it, for the confirmation ("at 5:00 PM"). */
  whenLabel: string;
  /** The thing to do, with the time phrase stripped out. */
  task: string;
}

/** True-ish signal that the founder is asking for something to be done. */
const IMPERATIVE =
  /\b(write|draft|post|send|make|create|research|find|check|prepare|schedule|remind|do|reply|message|dm|email|analyze|look)\b/i;

export function parseSchedule(
  text: string,
  timezone = "UTC",
): ParsedSchedule | null {
  const raw = text.trim();
  if (!raw) return null;

  const now = new Date();
  const offset = TZ_OFFSETS[timezone] ?? 0;

  // Where "now" is in the founder's local wall clock.
  const localNow = new Date(now.getTime() + offset * 60_000);

  let runLocal: Date | null = null;
  let matched = "";

  // "in 30 minutes" / "in 2 hours"
  const rel = /\bin\s+(\d{1,3})\s*(min(?:ute)?s?|hours?|hrs?)\b/i.exec(raw);
  if (rel) {
    const n = Number(rel[1]);
    const unit = rel[2].toLowerCase();
    const ms = unit.startsWith("h") ? n * 3600_000 : n * 60_000;
    // Relative times are absolute — no timezone maths needed.
    return {
      runAt: new Date(now.getTime() + ms),
      whenLabel: `in ${n} ${unit.startsWith("h") ? "hour" : "minute"}${n === 1 ? "" : "s"}`,
      task: stripPhrase(raw, rel[0]),
    };
  }

  // "at 5pm", "at 5:30 pm", "at 17:00", "at 5"
  const at =
    /\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i.exec(raw) ||
    /\bat\s+(\d{1,2})(?::(\d{2}))?\b/i.exec(raw);
  if (at) {
    let hour = Number(at[1]);
    const minute = at[2] ? Number(at[2]) : 0;
    const ampm = (at[3] ?? "").toLowerCase();
    if (ampm === "pm" && hour < 12) hour += 12;
    if (ampm === "am" && hour === 12) hour = 0;
    if (hour > 23 || minute > 59) return null;

    const target = new Date(localNow);
    target.setHours(hour, minute, 0, 0);

    // "tomorrow" moves it a day; otherwise a time already past today rolls to
    // tomorrow so "at 9am" at 3pm means tomorrow morning, not the past.
    if (/\btomorrow\b/i.test(raw)) target.setDate(target.getDate() + 1);
    else if (target.getTime() <= localNow.getTime())
      target.setDate(target.getDate() + 1);

    runLocal = target;
    matched = at[0];
  }

  if (!runLocal) return null;

  // Require an actual instruction, so "meet at 5" (a statement) is not
  // mistaken for "do something at 5".
  if (!IMPERATIVE.test(raw)) return null;

  // Convert the local wall-clock target back to real UTC.
  const runAt = new Date(runLocal.getTime() - offset * 60_000);
  // Never schedule into the past (clock skew, weird input).
  if (runAt.getTime() < now.getTime() - 60_000) return null;

  const label = formatLocal(runLocal, /\btomorrow\b/i.test(raw));

  return { runAt, whenLabel: label, task: stripPhrase(raw, matched) };
}

function formatLocal(d: Date, tomorrow: boolean): string {
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  const time = `${h}:${String(m).padStart(2, "0")} ${ampm}`;
  return tomorrow ? `tomorrow at ${time}` : time;
}

/** Remove the time phrase (and any dangling "at"/"and"/commas) from the task. */
function stripPhrase(text: string, phrase: string): string {
  return text
    .replace(phrase, "")
    .replace(/\b(tomorrow|today)\b/i, "")
    .replace(/\band\s+(message|ping|tell|dm|text)\s+me\b/i, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s,;.-]+|[\s,;.-]+$/g, "")
    .trim();
}
