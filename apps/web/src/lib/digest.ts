import "server-only";
import { createAdminClient } from "./supabase/admin";
import { DAILY_LEAD_TARGET, DAILY_SEND_CAP } from "./pipeline";

type Admin = ReturnType<typeof createAdminClient>;

/**
 * "What did the team actually do today?"
 *
 * Written as a colleague's end-of-day message, not a metrics dashboard. The
 * founder is reading it on a phone, probably while doing something else, and
 * the only question they have is whether the day moved. So it leads with what
 * was finished, and it counts real rows rather than describing intentions —
 * every number here is something that exists in the database and can be opened.
 *
 * The leads file is not attached. Fifty rows of contact data pushed at someone
 * unprompted every evening is noise, and it is the kind of noise that gets a
 * bot muted. The digest says the file is ready and how to ask for it; the
 * founder asks on the days they want it.
 */

export interface DayCounts {
  found: number;
  qualified: number;
  rejected: number;
  written: number;
  sent: number;
  waitingApproval: number;
  research: number;
  drafts: number;
  spend: number;
}

export async function countToday(admin: Admin, userId: string): Promise<DayCounts> {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  const iso = since.toISOString();

  // One read of today's leads is cheaper and more consistent than six counting
  // queries — and it means the numbers below always describe the same instant.
  const { data: leadRows } = await admin
    .from("leads")
    .select("stage, cost, created_at, sent_at")
    .eq("user_id", userId)
    .gte("created_at", iso)
    .limit(1000);

  const leads = (leadRows ?? []) as {
    stage: string;
    cost: number | string | null;
    sent_at: string | null;
  }[];

  // Sent is counted by `sent_at` rather than by stage: a lead found yesterday
  // and sent today belongs to today's work, and stage alone would miss it.
  const { count: sentCount } = await admin
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("sent_at", iso);

  const { count: waiting } = await admin
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("stage", "written");

  const { data: gens } = await admin
    .from("generations")
    .select("kind")
    .eq("user_id", userId)
    .gte("created_at", iso)
    .limit(500);

  const generations = (gens ?? []) as { kind: string }[];

  const atLeast = (...stages: string[]) =>
    leads.filter((l) => stages.includes(l.stage)).length;

  return {
    found: leads.length,
    // A lead that moved on is still a lead that was qualified today, so the
    // later stages count toward it. Reporting only the ones sitting in
    // 'qualified' would make a fast day look like a quiet one.
    qualified: atLeast("qualified", "enriched", "written", "approved", "sent"),
    rejected: atLeast("rejected"),
    written: atLeast("written", "approved", "sent"),
    sent: sentCount ?? 0,
    waitingApproval: waiting ?? 0,
    research: generations.filter((g) => g.kind === "note" || g.kind === "alert").length,
    drafts: generations.filter((g) => g.kind === "post").length,
    spend: leads.reduce((sum, l) => sum + Number(l.cost ?? 0), 0),
  };
}

/** A plain-language line per task, or null when the task did not happen. */
function taskLines(counts: DayCounts): string[] {
  const lines: string[] = [];

  if (counts.found) {
    const target =
      counts.found >= DAILY_LEAD_TARGET
        ? ""
        : ` (target is ${DAILY_LEAD_TARGET} — the rest come through the day)`;
    lines.push(`Found ${counts.found} new leads${target}.`);
  }

  if (counts.qualified || counts.rejected) {
    lines.push(
      `Checked them against your customer: kept ${counts.qualified}, dropped ${counts.rejected}.`,
    );
  }

  if (counts.written) {
    lines.push(`Wrote ${counts.written} cold emails — one each, none of them templates.`);
  }

  if (counts.sent) {
    lines.push(`Sent ${counts.sent} of them (cap is ${DAILY_SEND_CAP} a day, to protect your domain).`);
  }

  if (counts.research) {
    lines.push(`${counts.research} research and competitor notes.`);
  }

  if (counts.drafts) {
    lines.push(`${counts.drafts} drafts ready for you.`);
  }

  return lines;
}

/**
 * The message, as the head agent would text it.
 *
 * Plain text and short. A quiet day says so in one line rather than printing
 * six zeroes — a digest that reports nothing happening in the same shape as a
 * digest reporting a good day teaches the founder to stop reading both.
 */
export function digestText(counts: DayCounts, headName: string): string {
  const lines = taskLines(counts);

  if (!lines.length) {
    return (
      `${headName} here. Nothing landed today — no leads, no drafts.\n\n` +
      `If that is a surprise, reply "diagnose" and I will tell you exactly what is stuck.`
    );
  }

  const out = [`${headName} here. Today:`, "", ...lines.map((line) => `• ${line}`)];

  if (counts.waitingApproval) {
    out.push(
      "",
      `${counts.waitingApproval} ${counts.waitingApproval === 1 ? "email is" : "emails are"} ` +
        `written and waiting on you. Reply 1 to approve them, or 2 to read them first.`,
    );
  }

  if (counts.found) {
    out.push("", `Want today's leads as a file? Reply "leads".`);
  }

  if (counts.spend > 0) {
    out.push("", `Data cost today: $${counts.spend.toFixed(2)}.`);
  }

  return out.join("\n");
}

/**
 * Today's leads as a CSV, for the founder who asked for the file.
 *
 * Only what they can act on. Fields are quoted defensively — a company name
 * with a comma in it would otherwise shift every later column, and a leading
 * `=` or `+` in a spreadsheet is a formula rather than text, which is how a
 * name becomes an executable cell.
 */
export async function leadsCsv(admin: Admin, userId: string): Promise<string> {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);

  const { data } = await admin
    .from("leads")
    .select("full_name, title, company, company_domain, location, email, linkedin_url, stage, qualify_score, qualify_reason, email_subject")
    .eq("user_id", userId)
    .gte("created_at", since.toISOString())
    .neq("stage", "rejected")
    .order("qualify_score", { ascending: false })
    .limit(500);

  const rows = (data ?? []) as Record<string, unknown>[];

  const headers = [
    "name",
    "title",
    "company",
    "domain",
    "location",
    "email",
    "linkedin",
    "stage",
    "score",
    "why",
    "subject",
  ];

  const escape = (value: unknown): string => {
    const text = value == null ? "" : String(value);
    // Neutralise spreadsheet formula injection before quoting.
    const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
    return `"${safe.replace(/"/g, '""')}"`;
  };

  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(
      [
        row.full_name,
        row.title,
        row.company,
        row.company_domain,
        row.location,
        row.email,
        row.linkedin_url,
        row.stage,
        row.qualify_score,
        row.qualify_reason,
        row.email_subject,
      ]
        .map(escape)
        .join(","),
    );
  }

  return lines.join("\n");
}
