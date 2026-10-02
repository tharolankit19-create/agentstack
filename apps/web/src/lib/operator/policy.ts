import { createHash } from "node:crypto";
export type Risk =
  | "READ"
  | "SAFE_WRITE"
  | "EXTERNAL_COMMUNICATION"
  | "PUBLIC_PUBLISH"
  | "FINANCIAL"
  | "DESTRUCTIVE"
  | "SECURITY";
export const actions: Record<string, Risk> = {
  "model.complete": "SAFE_WRITE",
  "web.search": "READ",
  "web.read": "READ",
  "computer.capture": "READ",
  "artifact.create": "SAFE_WRITE",
  "email.send": "EXTERNAL_COMMUNICATION",
  "social.publish": "PUBLIC_PUBLISH",
  "production.deploy": "SECURITY",
  purchase: "FINANCIAL",
  delete: "DESTRUCTIVE",
};
export function decide(action: string, rule?: string) {
  if (!actions[action]) return "DENY";
  if (rule === "DENY") return "DENY";
  if (rule === "ALLOW") return "ALLOW";
  if (rule === "ASK") return "ASK";
  return ["READ", "SAFE_WRITE"].includes(actions[action]) ? "ALLOW" : "ASK";
}
function canonical(v: unknown): string {
  if (Array.isArray(v)) return "[" + v.map(canonical).join(",") + "]";
  if (v && typeof v === "object")
    return (
      "{" +
      Object.entries(v)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, x]) => JSON.stringify(k) + ":" + canonical(x))
        .join(",") +
      "}"
    );
  return JSON.stringify(v) ?? "null";
}
export const fingerprint = (action: string, payload: unknown) =>
  createHash("sha256")
    .update(action + "\n" + canonical(payload))
    .digest("hex");
export function redact(value: unknown, secrets: string[] = []): unknown {
  if (typeof value === "string") {
    let s = value;
    for (const secret of secrets.filter((s) => s.length > 5))
      s = s.split(secret).join("[REDACTED]");
    return s
      .replace(/Bearer\s+[\w.\-]+/gi, "Bearer [REDACTED]")
      .replace(/\b(?:sk-(?:or-v1-)?|re_|fc-)[\w-]{12,}/g, "[REDACTED]");
  }
  if (Array.isArray(value)) return value.map((v) => redact(v, secrets));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [
        k,
        /api[_-]?key|password|secret|token|cookie|authorization|credential/i.test(
          k,
        )
          ? "[REDACTED]"
          : redact(v, secrets),
      ]),
    );
  return value;
}
export interface Provider {
  id: string;
  kind: "native" | "api" | "mcp" | "browser";
  capabilities: string[];
  available: boolean;
  userOwned: boolean;
  cost: number;
}
export function routeTool(capability: string, providers: Provider[]) {
  const rank = { native: 0, api: 1, mcp: 2, browser: 3 };
  return (
    providers
      .filter((p) => p.available && p.capabilities.includes(capability))
      .sort(
        (a, b) =>
          rank[a.kind] - rank[b.kind] ||
          Number(b.userOwned) - Number(a.userOwned) ||
          a.cost - b.cost,
      )[0] ?? null
  );
}
export function nextRoutine(
  schedule: {
    hour: number;
    minute: number;
    weekdays: number[];
    timezone: string;
  },
  after: Date,
): string {
  const f = new Intl.DateTimeFormat("en-US", {
      timeZone: schedule.timezone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }),
    days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  for (
    let t = Math.floor(after.getTime() / 60000) * 60000 + 60000;
    t <= after.getTime() + 8 * 86400000;
    t += 60000
  ) {
    const p = Object.fromEntries(
      f.formatToParts(t).map((p) => [p.type, p.value]),
    );
    if (
      +p.hour === schedule.hour &&
      +p.minute === schedule.minute &&
      schedule.weekdays.includes(days.indexOf(p.weekday))
    )
      return new Date(t).toISOString();
  }
  throw new Error("No next occurrence");
}
