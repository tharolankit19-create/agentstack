import { z } from "zod";

export const statuses = [
  "PLANNING",
  "READY",
  "RUNNING",
  "WAITING",
  "WAITING_FOR_APPROVAL",
  "PAUSED",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
] as const;
export const operations = [
  "research",
  "qualify",
  "draft",
  "audit",
  "monitor",
  "report",
] as const;
export const planSchema = z.object({
  title: z.string().min(1).max(160),
  steps: z
    .array(
      z.object({
        key: z.string().regex(/^[a-z][a-z0-9_-]{0,60}$/),
        title: z.string().min(1).max(160),
        objective: z.string().min(1).max(4000),
        operation: z.enum(operations),
        depends_on: z.array(z.string()).max(20),
        inputs: z.record(z.string(), z.unknown()).default({}),
      }),
    )
    .min(1)
    .max(24),
});
export type Plan = z.infer<typeof planSchema>;
export function validateModelOutput(
  instruction: string,
  output: string,
): string {
  if (!/Return (?:only )?JSON/i.test(instruction)) return output;
  const value = JSON.parse(
    output
      .trim()
      .replace(/^```(?:json)?\s*/, "")
      .replace(/\s*```$/, ""),
  );
  if (instruction.includes("title,steps"))
    return JSON.stringify(validatePlan(value));
  if (instruction.includes("{leads:") && !Array.isArray(value.leads))
    throw new Error("Expected structured leads");
  if (instruction.includes("{drafts:"))
    z.object({
      drafts: z.array(
        z.object({
          index: z.number().int().min(0),
          subject: z.string().min(1),
          text: z.string().min(1),
        }),
      ),
    }).parse(value);
  if (instruction.includes("{material:"))
    z.object({
      material: z.boolean(),
      summary: z.string(),
      quote: z.string(),
    }).parse(value);
  return JSON.stringify(value);
}
export function validatePlan(value: unknown): Plan {
  const p = planSchema.parse(value),
    keys = new Set(p.steps.map((s) => s.key));
  if (keys.size !== p.steps.length || keys.has("plan"))
    throw new Error("Duplicate or reserved task key");
  const visiting = new Set<string>(),
    visited = new Set<string>();
  const visit = (key: string) => {
    if (visiting.has(key)) throw new Error("Plan contains a cycle");
    if (visited.has(key)) return;
    visiting.add(key);
    const s = p.steps.find((s) => s.key === key)!;
    for (const d of s.depends_on) {
      if (!keys.has(d)) throw new Error("Missing dependency");
      visit(d);
    }
    visiting.delete(key);
    visited.add(key);
  };
  p.steps.forEach((s) => {
    visit(s.key);
    if (s.operation === "qualify" && !s.depends_on.length)
      throw new Error("Qualification requires research evidence");
  });
  return p;
}
export interface Goal {
  id: string;
  user_id: string;
  objective: string;
  status: string;
  context: Record<string, unknown>;
  plan: Plan | null;
  budget: number;
  spent: number;
  created_at: string;
}
export interface Task {
  id: string;
  key: string;
  goal_id: string;
  user_id: string;
  title: string;
  objective: string;
  operation: string;
  inputs: Record<string, unknown>;
  status: string;
  lease_token: string;
  retry_count: number;
  output: Record<string, unknown>;
  progress: number;
}
export interface Evidence {
  url: string;
  text: string;
  retrieved_at: string;
}
export interface Artifact {
  name: string;
  type: string;
  content: string;
  sources: Evidence[];
  mime?: string;
}
export const leadSchema = z.object({
  name: z.string(),
  product: z.string(),
  product_url: z.url(),
  founder_url: z.url(),
  source_url: z.url(),
  launched_at: z.iso.date(),
  quote: z.string().min(10),
  score: z.number().min(0).max(100),
  reason: z.string(),
  email: z.email().nullable(),
});
export type Lead = z.infer<typeof leadSchema>;
export function qualifyLeads(
  rows: unknown[],
  sources: Evidence[],
  now = new Date(),
): Lead[] {
  const result: Lead[] = [],
    seen = new Set<string>();
  for (const row of rows) {
    const r = leadSchema.safeParse(row);
    if (!r.success) continue;
    const l = r.data,
      s = sources.find((s) => s.url === l.source_url),
      age = now.getTime() - Date.parse(l.launched_at);
    if (
      !s ||
      !s.text.includes(l.quote) ||
      age < 0 ||
      age > 8 * 86400000 ||
      l.score < 60
    )
      continue;
    const host = new URL(l.product_url).hostname.replace(/^www\./, "");
    if (seen.has(host)) continue;
    if (
      !s.text.includes(l.name) ||
      !s.text.includes(l.product) ||
      !s.text.includes(l.launched_at)
    )
      continue;
    if (l.email && !s.text.includes(l.email)) l.email = null;
    seen.add(host);
    result.push(l);
  }
  return result;
}
export function csv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const keys = Object.keys(rows[0]);
  const cell = (v: unknown) => {
    let s = String(v ?? "");
    if (/^[\s]*[=+@-]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  };
  return [
    keys.map(cell).join(","),
    ...rows.map((r) => keys.map((k) => cell(r[k])).join(",")),
  ].join("\n");
}
