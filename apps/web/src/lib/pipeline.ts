import "server-only";
import { createAdminClient } from "./supabase/admin";
import { runCapability } from "./monid-capabilities";
import { scrape } from "./firecrawl";
import { chatComplete } from "./chat-model";
import { sendEmail, validFrom } from "./resend";

type Admin = ReturnType<typeof createAdminClient>;

/**
 * The outreach pipeline: five stages, each owned by one agent.
 *
 *   lead agent      → finds people                              → found
 *   filter (CRM)    → keeps the ones worth writing to, with why → qualified
 *   outreach agent  → finds an address                          → enriched
 *   copywriter      → writes one email for that one person      → written
 *   outreach agent  → sends it, slowly                          → sent
 *
 * Splitting it this way is not ceremony. Each stage is a different kind of
 * failure: a search returning nothing, a filter being too strict, an address
 * that does not exist, a model writing a template. Kept in one function they
 * are indistinguishable and the whole batch dies together; kept apart, a lead
 * stops at the stage that failed and says which one, and the next tick resumes
 * from there rather than paying for the search again.
 *
 * Everything is bounded per tick. These run unattended every few minutes on a
 * founder's balance, so a runaway loop is not a performance problem — it is a
 * bill.
 */

/** How many leads each stage moves per tick. Small: this runs every 15 minutes. */
const BATCH = { qualify: 12, enrich: 8, write: 6, send: 4 } as const;

/**
 * The daily send ceiling.
 *
 * Cold outreach becomes spam at volume, and the damage is not a bounced email —
 * it is the founder's sending domain, which does not recover quickly. Fifty
 * *found* leads a day is the product's promise; fifty *sent* is a domain
 * burned in a fortnight. So the pipeline fills freely and the door out is
 * narrow, and this is the number that keeps them apart.
 */
export const DAILY_SEND_CAP = 20;

/** How many new leads a day the founder is promised. */
export const DAILY_LEAD_TARGET = 50;

export interface LeadRow {
  id: string;
  user_id: string;
  stage: string;
  full_name: string | null;
  title: string | null;
  company: string | null;
  company_domain: string | null;
  location: string | null;
  linkedin_url: string | null;
  email: string | null;
  qualify_reason: string | null;
  qualify_score: number | null;
  trigger: string | null;
  email_subject: string | null;
  email_body: string | null;
  source: string | null;
  cost: number;
  error: string | null;
  dedupe_key: string;
  created_at: string;
  sent_at: string | null;
}

/**
 * The one thing that makes two rows the same person.
 *
 * Email first because it is the thing being written to; then LinkedIn, which is
 * stable across job changes; then name and company, which is the weakest but
 * still stops the same search re-inserting the same twenty people every night.
 * Anything with no identity at all is refused rather than given a random key —
 * a row nothing can match is a row that arrives again tomorrow.
 */
export function dedupeKey(lead: Partial<LeadRow>): string | null {
  const email = lead.email?.trim().toLowerCase();
  if (email && email.includes("@")) return `e:${email}`;

  const linkedin = lead.linkedin_url?.trim().toLowerCase().replace(/\/+$/, "");
  if (linkedin) return `l:${linkedin}`;

  const name = lead.full_name?.trim().toLowerCase();
  const company = (lead.company ?? lead.company_domain)?.trim().toLowerCase();
  if (name && company) return `n:${name}|${company}`;

  return null;
}

/**
 * Read whichever key a provider used for a field. Sources disagree wildly.
 *
 * Case-insensitive because providers are inconsistent about camelCase, and one
 * level into nested objects because several return the company as an
 * `organization: { name, primary_domain }` sub-object rather than flat fields.
 * Without that second pass those rows arrive looking like valid leads with the
 * company silently missing, which is the worst shape of failure here: the
 * filter then judges a person with no employer and drops them for it.
 */
function pick(row: Record<string, unknown>, ...names: string[]): string | null {
  const read = (source: Record<string, unknown>): string | null => {
    for (const name of names) {
      for (const key of Object.keys(source)) {
        if (key.toLowerCase() !== name.toLowerCase()) continue;
        const value = source[key];
        if (typeof value === "string" && value.trim()) return value.trim();
        if (typeof value === "number") return String(value);
      }
    }
    return null;
  };

  const flat = read(row);
  if (flat) return flat;

  // Inside an `organization` object, a bare `name` unambiguously means the
  // company. At the top level it means the person, which is why it can only be
  // tried here and never added to the flat alias list.
  const nestedOnly = names.some((n) => /company|organization|domain|employer/i.test(n))
    ? [...names, "name"]
    : names;

  for (const key of ["organization", "company", "employer", "account", "current_company"]) {
    const nested = Object.entries(row).find(([k]) => k.toLowerCase() === key)?.[1];
    if (!nested || typeof nested !== "object" || Array.isArray(nested)) continue;

    const source = nested as Record<string, unknown>;
    for (const name of nestedOnly) {
      for (const field of Object.keys(source)) {
        if (field.toLowerCase() !== name.toLowerCase()) continue;
        const value = source[field];
        if (typeof value === "string" && value.trim()) return value.trim();
        if (typeof value === "number") return String(value);
      }
    }
  }

  return null;
}

/**
 * A provider's row, mapped onto ours.
 *
 * Field names are read rather than assumed, because the endpoint serving a
 * capability is chosen at run time and changes as the catalogue does. Pinning
 * to `full_name` would work until discovery picked a different vendor, and then
 * fail silently by producing rows of nulls that all look like valid leads.
 */
export function toLead(row: Record<string, unknown>): Partial<LeadRow> {
  const first = pick(row, "first_name", "firstName", "given_name");
  const last = pick(row, "last_name", "lastName", "family_name", "surname");

  const email = pick(
    row,
    "email",
    "work_email",
    "workEmail",
    "email_address",
    "emailAddress",
    "primaryEmail",
    "primary_email",
    "business_email",
    "businessEmail",
  );

  return {
    full_name:
      pick(row, "full_name", "fullName", "name", "person_name") ??
      ([first, last].filter(Boolean).join(" ") || null),
    title: pick(row, "title", "job_title", "jobTitle", "headline", "position", "role"),
    company: pick(
      row,
      "company",
      "company_name",
      "companyName",
      "organization",
      "organization_name",
      "organizationName",
      "org_name",
      "employer",
      "current_company",
      "currentCompany",
    ),
    company_domain: pick(
      row,
      "domain",
      "company_domain",
      "companyDomain",
      "primary_domain",
      "primaryDomain",
      "website",
      "company_website",
      "companyWebsite",
    ),
    location: pick(row, "location", "city", "country", "region", "geo"),
    linkedin_url: pick(row, "linkedin_url", "linkedinUrl", "linkedin", "profile_url", "profileUrl"),
    // Apollo's locked placeholder reaches the founder as a real-looking address
    // that bounces, so it is dropped here rather than at every read site.
    email: email && email !== "email_not_unlocked@domain.com" ? email : null,
    trigger: pick(row, "trigger", "signal", "recent_news", "news"),
  };
}

/**
 * Who buys this, worked out from the site rather than asked at signup.
 *
 * "Describe your ideal customer" is the most valuable field in the product and
 * the one most likely to end a signup, because it asks someone to compose a
 * paragraph while they are still deciding whether to bother. So onboarding does
 * not ask it, and this reads the homepage instead — which is usually better
 * than what a founder types in a hurry, because the site is the version they
 * already edited.
 *
 * Written back to the head agent's config on success, so it is inferred once
 * rather than on every tick, and the founder can see and correct it. Returns
 * null rather than guessing from nothing: a fabricated customer profile would
 * aim every future search at the wrong people and look exactly like a real one.
 */
export async function deriveIcp(
  admin: Admin,
  headAgentId: string,
  modelKey: string,
  websiteUrl: string,
  firecrawlKey: string | null,
): Promise<string | null> {
  if (!websiteUrl.trim() || !firecrawlKey) return null;

  const page = await scrape(websiteUrl, 4000, firecrawlKey).catch(() => null);
  if (!page) return null;

  let reply: string;
  try {
    reply = await chatComplete(
      modelKey,
      "You read a company's homepage and say who buys from them, in one line a " +
        "lead-search tool could use: role, company type, size and place where the " +
        "page supports it.\n\n" +
        "Reply with the line only — no preamble, no quotes, under 25 words.\n\n" +
        "If the page does not say enough to tell, reply exactly: UNKNOWN. " +
        "A confident guess here aims every future search at the wrong people.",
      [{ role: "user", content: page.slice(0, 4000) }],
    );
  } catch {
    return null;
  }

  const icp = reply.trim().replace(/^["']|["']$/g, "");
  if (!icp || /^unknown/i.test(icp) || icp.length < 8) return null;

  const { data: head } = await admin
    .from("agents")
    .select("config")
    .eq("id", headAgentId)
    .maybeSingle<{ config: Record<string, string> | null }>();

  await admin
    .from("agents")
    .update({
      config: { ...(head?.config ?? {}), icp, icpInferred: "true" },
    })
    .eq("id", headAgentId);

  return icp;
}

/**
 * Stage one: find people and put them in the pipeline.
 *
 * Returns how many were new. Duplicates are not an error and not reported as
 * failure — the same search run twice a day *should* mostly collide, and a
 * pipeline that treats that as a problem would keep re-inserting the same
 * people with new ids.
 */
export async function findLeads(
  admin: Admin,
  userId: string,
  monidKey: string,
  icp: string,
  want: number,
): Promise<{ added: number; cost: number; reason: string | null; source: string | null }> {
  const found = await runCapability(monidKey, "leads", {
    query: icp,
    limit: Math.min(want, 25),
  });

  if (!found.ok || !found.rows.length) {
    return { added: 0, cost: found.cost, reason: found.reason ?? "No leads came back.", source: found.via };
  }

  const rows: Record<string, unknown>[] = [];
  for (const raw of found.rows) {
    const lead = toLead(raw);
    const key = dedupeKey(lead);
    if (!key) continue;
    rows.push({
      ...lead,
      user_id: userId,
      stage: "found",
      dedupe_key: key,
      source: found.via,
      // The run's cost is attributed to the first lead of the batch rather than
      // split, so the founder's ledger adds up to what Monid actually charged.
      cost: rows.length === 0 ? found.cost : 0,
    });
  }

  if (!rows.length) {
    return {
      added: 0,
      cost: found.cost,
      reason: "The rows that came back had nothing to identify a person by.",
      source: found.via,
    };
  }

  const { data } = await admin
    .from("leads")
    .upsert(rows, { onConflict: "user_id,dedupe_key", ignoreDuplicates: true })
    .select("id");

  return { added: data?.length ?? 0, cost: found.cost, reason: null, source: found.via };
}

/**
 * Stage two: keep the ones worth writing to, and say why.
 *
 * One model call for the whole batch rather than one per lead — the judgement
 * is comparative ("which of these fit"), and asking about each in isolation
 * produces a yes for almost all of them.
 */
export async function qualifyLeads(
  admin: Admin,
  userId: string,
  modelKey: string,
  icp: string,
): Promise<{ qualified: number; rejected: number }> {
  const { data } = await admin
    .from("leads")
    .select("*")
    .eq("user_id", userId)
    .eq("stage", "found")
    .order("created_at", { ascending: true })
    .limit(BATCH.qualify);

  const leads = (data ?? []) as LeadRow[];
  if (!leads.length) return { qualified: 0, rejected: 0 };

  const roster = leads
    .map(
      (lead, index) =>
        `${index + 1}. ${lead.full_name ?? "unknown"} — ${lead.title ?? "title unknown"} at ` +
        `${lead.company ?? lead.company_domain ?? "unknown company"}` +
        `${lead.location ? ` (${lead.location})` : ""}`,
    )
    .join("\n");

  const system =
    "You qualify B2B leads against one customer profile. You are strict: the " +
    "cost of keeping a bad lead is a wasted email and a burned address, and the " +
    "cost of dropping a good one is nothing, because more arrive tomorrow.\n\n" +
    `The customer profile: ${icp}\n\n` +
    "For EACH numbered lead reply with exactly one line, no preamble:\n" +
    "<number>|<KEEP or DROP>|<score 0-10>|<one short reason>\n\n" +
    "Judge only on what you are told. Never invent a fact about a person to " +
    "justify keeping them. A lead with a missing title is judged on what is " +
    "there, not on a guess about what is missing.";

  let reply: string;
  try {
    reply = await chatComplete(modelKey, system, [{ role: "user", content: roster }]);
  } catch {
    return { qualified: 0, rejected: 0 };
  }

  let qualified = 0;
  let rejected = 0;

  for (const line of reply.split("\n")) {
    const match = /^\s*(\d+)\s*\|\s*(KEEP|DROP)\s*\|\s*(\d+)\s*\|\s*(.+)$/i.exec(line.trim());
    if (!match) continue;

    const lead = leads[Number(match[1]) - 1];
    if (!lead) continue;

    const keep = match[2].toUpperCase() === "KEEP";
    await admin
      .from("leads")
      .update({
        stage: keep ? "qualified" : "rejected",
        qualify_score: Math.max(0, Math.min(Number(match[3]), 10)),
        qualify_reason: match[4].trim().slice(0, 300),
        updated_at: new Date().toISOString(),
      })
      .eq("id", lead.id);

    if (keep) qualified += 1;
    else rejected += 1;
  }

  return { qualified, rejected };
}

/**
 * Stage three: find an address for the ones that were kept.
 *
 * A lead that already has one skips straight through — paying to enrich a row
 * that arrived complete is the easiest money in this whole pipeline to waste.
 * A lead that cannot be given one goes to `failed` rather than back in the
 * queue, so it is not enriched again every tick forever.
 */
export async function enrichLeads(
  admin: Admin,
  userId: string,
  monidKey: string,
): Promise<{ enriched: number; failed: number; cost: number }> {
  const { data } = await admin
    .from("leads")
    .select("*")
    .eq("user_id", userId)
    .eq("stage", "qualified")
    .order("qualify_score", { ascending: false })
    .limit(BATCH.enrich);

  const leads = (data ?? []) as LeadRow[];
  let enriched = 0;
  let failed = 0;
  let cost = 0;

  for (const lead of leads) {
    if (lead.email) {
      await admin.from("leads").update({ stage: "enriched" }).eq("id", lead.id);
      enriched += 1;
      continue;
    }

    const who = [lead.full_name, lead.company ?? lead.company_domain].filter(Boolean).join(" ");
    if (!who) {
      await admin
        .from("leads")
        .update({ stage: "failed", error: "Not enough to search for an address." })
        .eq("id", lead.id);
      failed += 1;
      continue;
    }

    const result = await runCapability(monidKey, "email", { query: who, limit: 3 });
    cost += result.cost;

    const address = result.rows.map((row) => toLead(row).email).find(Boolean) ?? null;

    if (address) {
      await admin
        .from("leads")
        .update({ stage: "enriched", email: address, cost: lead.cost + result.cost })
        .eq("id", lead.id);
      enriched += 1;
    } else {
      await admin
        .from("leads")
        .update({
          stage: "failed",
          error: result.reason ?? "No address found for this person.",
          cost: lead.cost + result.cost,
        })
        .eq("id", lead.id);
      failed += 1;
    }
  }

  return { enriched, failed, cost };
}

/**
 * The rules that decide whether a cold email gets a reply or a spam report.
 *
 * Stated once, here, because they are the actual product of this pipeline. The
 * no-link rule is the load-bearing one and the least obvious: a link in a first
 * cold email is the single strongest spam signal a filter reads, and it buys
 * nothing — nobody clicks a link from a stranger they have not answered yet.
 */
const EMAIL_CRAFT = `
How you write:
- Under 90 words. Every sentence must earn its place; the best cold emails feel
  like they could have been shorter, not longer.
- Write like a peer emailing a peer, never like a vendor. Contractions. Plain.
- Lead with THEIR world, not your product. "You/your" should outnumber "I/we".
- The personalisation must connect to why you are writing. If you can delete the
  first line and the email still makes sense, the personalisation is decoration.
- One ask, and make it a direct question they can answer in five words.
- Subject line looks like an internal note: two or three lowercase words, no
  punctuation at the end, no capitals, never a pitch.

Never:
- NO LINKS. Not one, not a calendar link, not a website. A link in a first cold
  email is the strongest spam signal there is, and nobody clicks one from a
  stranger. The reply is the goal; the link comes after they answer.
- No "I hope this finds you well", no "I wanted to reach out", no "quick
  question", no "circling back", no feature list, no bullet points.
- Never claim you read their blog, used their product, or saw their launch. You
  did not. Only reference what you were actually given below.
- Never invent a metric, a funding round, a headcount or a customer.
`.trim();

/**
 * Stage four: one email, for one person.
 *
 * Deliberately one model call per lead. Batching would be cheaper and would
 * produce the thing this is meant to prevent — a template with the name
 * swapped, which reads as exactly what it is.
 */
export async function writeEmails(
  admin: Admin,
  userId: string,
  modelKey: string,
  context: { businessContext: string; senderName: string; offer: string },
): Promise<{ written: number }> {
  const { data } = await admin
    .from("leads")
    .select("*")
    .eq("user_id", userId)
    .eq("stage", "enriched")
    .order("qualify_score", { ascending: false })
    .limit(BATCH.write);

  const leads = (data ?? []) as LeadRow[];
  let written = 0;

  for (const lead of leads) {
    const system =
      `You write one cold email, from ${context.senderName}.\n\n` +
      `What ${context.senderName} does: ${context.businessContext}\n` +
      (context.offer ? `The offer: ${context.offer}\n` : "") +
      `\n${EMAIL_CRAFT}\n\n` +
      "Reply with exactly this and nothing else:\n" +
      "SUBJECT: <subject>\n" +
      "BODY:\n<body>";

    const about = [
      `Name: ${lead.full_name ?? "unknown"}`,
      lead.title ? `Title: ${lead.title}` : null,
      lead.company ? `Company: ${lead.company}` : null,
      lead.company_domain ? `Site: ${lead.company_domain}` : null,
      lead.location ? `Location: ${lead.location}` : null,
      lead.trigger ? `Why now: ${lead.trigger}` : null,
      lead.qualify_reason ? `Why they fit: ${lead.qualify_reason}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    let reply: string;
    try {
      reply = await chatComplete(modelKey, system, [
        { role: "user", content: `Write the email to this person:\n${about}` },
      ]);
    } catch {
      continue;
    }

    const subject = /SUBJECT:\s*(.+)/i.exec(reply)?.[1]?.trim();
    const body = reply.split(/BODY:\s*/i)[1]?.trim();
    if (!subject || !body) continue;

    // The no-link rule is enforced, not just requested. A model that slips one
    // in would otherwise cost the founder the deliverability this whole stage
    // exists to protect, and they would never know why replies stopped.
    const hasLink = /https?:\/\/|www\.|\[.+?\]\(.+?\)/i.test(body);
    if (hasLink) {
      const stripped = body
        .replace(/https?:\/\/\S+/gi, "")
        .replace(/\bwww\.\S+/gi, "")
        .replace(/\s{2,}/g, " ")
        .trim();
      if (stripped.length < 40) continue; // Nothing left worth sending.
      await admin
        .from("leads")
        .update({ stage: "written", email_subject: subject.slice(0, 200), email_body: stripped })
        .eq("id", lead.id);
    } else {
      await admin
        .from("leads")
        .update({ stage: "written", email_subject: subject.slice(0, 200), email_body: body })
        .eq("id", lead.id);
    }

    written += 1;
  }

  return { written };
}

/**
 * Stage five: send, slowly, and only what the founder approved.
 *
 * Two gates before anything leaves. The founder must have approved the lead —
 * nothing in this pipeline sends on its own, which is the promise the whole
 * product rests on — and the day's cap must not be spent.
 *
 * Sends are spaced rather than fired together. A burst of identical-looking
 * messages from a new domain in one second is the pattern every filter is
 * tuned for; the same messages a few seconds apart are not. It costs a few
 * seconds of a cron that has minutes.
 */
export async function sendApproved(
  admin: Admin,
  userId: string,
  resendKey: string,
  from: string,
  timezone: string,
  replyTo?: string,
): Promise<{ sent: number; failed: number; capped: boolean }> {
  if (!validFrom(from)) return { sent: 0, failed: 0, capped: false };

  const { data: usedToday } = await admin.rpc("sent_today", {
    p_user_id: userId,
    p_timezone: timezone,
  });
  const remaining = DAILY_SEND_CAP - (typeof usedToday === "number" ? usedToday : 0);
  if (remaining <= 0) return { sent: 0, failed: 0, capped: true };

  const { data } = await admin
    .from("leads")
    .select("*")
    .eq("user_id", userId)
    .eq("stage", "approved")
    .not("email", "is", null)
    .order("qualify_score", { ascending: false })
    .limit(Math.min(BATCH.send, remaining));

  const leads = (data ?? []) as LeadRow[];
  let sent = 0;
  let failed = 0;

  for (const [index, lead] of leads.entries()) {
    if (!lead.email || !lead.email_subject || !lead.email_body) continue;

    // Claim it first. A second tick overlapping this one must not send the same
    // email twice — a duplicate cold email is worse than none at all.
    const { data: claimed } = await admin
      .from("leads")
      .update({ stage: "sent", sent_at: new Date().toISOString() })
      .eq("id", lead.id)
      .eq("stage", "approved")
      .select("id");
    if (!claimed?.length) continue;

    const result = await sendEmail(resendKey, {
      from,
      to: lead.email,
      subject: lead.email_subject,
      text: lead.email_body,
      replyTo,
    });

    if (result.ok) {
      sent += 1;
    } else {
      // Back to approved, with the reason. The founder sees why, and the next
      // tick retries — unless the reason is a bad key, in which case every
      // retry fails identically and the digest will say so.
      await admin
        .from("leads")
        .update({ stage: "approved", sent_at: null, error: result.error })
        .eq("id", lead.id);
      failed += 1;
    }

    if (index < leads.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 4_000));
    }
  }

  return { sent, failed, capped: false };
}

export { BATCH };

// ---------------------------------------------------------------------------
// Fifty a morning: the part that makes the number reachable
// ---------------------------------------------------------------------------

/**
 * How many separate searches one tick may pay for.
 *
 * Bounded because each one is a real charge. Four angles at up to twenty-five
 * rows is a hundred candidates a tick, which reaches fifty new leads in one
 * pass on a good day and two on a bad one — and the pipeline ticks every
 * fifteen minutes, so a bad day still finishes before the founder is awake.
 */
const ANGLES_PER_TICK = 4;

/** Zero-yield runs an angle gets before it stops costing money. */
const DRY_LIMIT = 3;

export interface LeadAngle {
  id: string;
  angle: string;
  uses: number;
  yield: number;
  dry_streak: number;
}

/**
 * Break one customer profile into the narrower searches that actually find
 * people.
 *
 * Asked once per founder and stored, because it is a description of their
 * market rather than of today. Every angle is a complete search string on its
 * own — the vendor is given one of these verbatim, so "founders" is useless and
 * "dental practice owners in Texas with 2-10 staff" is a query.
 *
 * The ICP itself is always kept as one of the angles. If the model returns
 * nothing usable the founder still has a working search, which is the whole
 * point of storing the fallback rather than depending on the derivation.
 */
export async function deriveAngles(
  admin: Admin,
  userId: string,
  modelKey: string | null,
  icp: string,
): Promise<LeadAngle[]> {
  const { data: existing } = await admin
    .from("lead_angles")
    .select("id, angle, uses, yield, dry_streak")
    .eq("user_id", userId)
    .is("retired_at", null)
    .order("last_used_at", { ascending: true, nullsFirst: true });

  if (existing?.length) return existing as LeadAngle[];

  const angles = new Set<string>([icp.trim()]);

  if (modelKey) {
    try {
      const reply = await chatComplete(
        modelKey,
        "You turn one customer profile into 8 narrower searches that a B2B " +
          "people-search tool can run.\n\n" +
          "Vary them along the axes that actually change who comes back: job " +
          "title and its synonyms, seniority, city or region, industry niche, " +
          "and company size. Each line must be a complete search on its own — " +
          "it is sent to the tool word for word, with no other context.\n\n" +
          "One per line, no numbering, no commentary, under 15 words each. " +
          "Never invent a place or an industry the profile does not support: a " +
          "search for the wrong people costs the same as a search for the right " +
          "ones.",
        [{ role: "user", content: icp }],
      );
      for (const line of reply.split("\n")) {
        const angle = line.replace(/^[\s\-*\d.)]+/, "").trim().replace(/^["']|["']$/g, "");
        if (angle.length >= 8 && angle.length <= 120) angles.add(angle);
      }
    } catch {
      // The fallback below is the ICP itself, which is what the pipeline used
      // before angles existed. A failed derivation is a smaller list, not a
      // stopped pipeline.
    }
  }

  const rows = [...angles].slice(0, 12).map((angle) => ({
    user_id: userId,
    angle,
    origin: angle === icp.trim() ? "icp" : "derived",
  }));

  await admin
    .from("lead_angles")
    .upsert(rows, { onConflict: "user_id,angle", ignoreDuplicates: true });

  const { data: saved } = await admin
    .from("lead_angles")
    .select("id, angle, uses, yield, dry_streak")
    .eq("user_id", userId)
    .is("retired_at", null)
    .order("last_used_at", { ascending: true, nullsFirst: true });

  return (saved ?? []) as LeadAngle[];
}

/**
 * Stage zero, properly: search until the day's promise is met.
 *
 * The old version ran one search per tick with the same string and then
 * wondered why the count stopped moving. This rotates least-recently-used
 * angles, stops the moment the shortfall closes, and scores each angle by what
 * it returned so a slice of the market that is exhausted is retired rather than
 * asked a fourth time.
 *
 * Ordering by `last_used_at` is what makes the rotation fair without storing a
 * cursor: an angle used just now sorts last, so the next tick reaches for a
 * different one automatically, and an angle added later — because the founder
 * changed their ICP — sorts first and gets tried immediately.
 */
export async function topUpLeads(
  admin: Admin,
  userId: string,
  monidKey: string,
  modelKey: string | null,
  icp: string,
  timezone: string,
): Promise<{
  wanted: number;
  added: number;
  cost: number;
  searches: number;
  retired: string[];
  reason: string | null;
}> {
  const { data: foundToday } = await admin.rpc("found_today", {
    p_user_id: userId,
    p_timezone: timezone,
  });

  const already = typeof foundToday === "number" ? foundToday : 0;
  const wanted = DAILY_LEAD_TARGET - already;
  if (wanted <= 0) {
    return { wanted: 0, added: 0, cost: 0, searches: 0, retired: [], reason: null };
  }

  const angles = await deriveAngles(admin, userId, modelKey, icp);
  if (!angles.length) {
    return {
      wanted,
      added: 0,
      cost: 0,
      searches: 0,
      retired: [],
      reason: "No search angles yet — the customer profile produced none.",
    };
  }

  let added = 0;
  let cost = 0;
  let searches = 0;
  const retired: string[] = [];
  let reason: string | null = null;

  for (const angle of angles) {
    if (added >= wanted || searches >= ANGLES_PER_TICK) break;

    // Claimed before it runs, not after. Two overlapping ticks would otherwise
    // both pick the least-recently-used angle and pay for the same search
    // twice, which is exactly the duplicate spend angles exist to stop.
    const { data: claimed } = await admin
      .from("lead_angles")
      .update({ last_used_at: new Date().toISOString(), uses: angle.uses + 1 })
      .eq("id", angle.id)
      .eq("uses", angle.uses)
      .select("id");
    if (!claimed?.length) continue;

    searches += 1;
    const result = await findLeads(
      admin,
      userId,
      monidKey,
      angle.angle,
      Math.min(wanted - added, 25),
    );

    added += result.added;
    cost += result.cost;
    if (result.reason && !reason) reason = result.reason;

    const dry = result.added === 0 ? angle.dry_streak + 1 : 0;
    const done = dry >= DRY_LIMIT;
    if (done) retired.push(angle.angle);

    await admin
      .from("lead_angles")
      .update({
        yield: angle.yield + result.added,
        dry_streak: dry,
        // Retiring the ICP angle itself would leave a founder whose derivation
        // failed with nothing at all, so it is never retired — a repeat search
        // that finds nobody is cheap next to a pipeline that has stopped.
        ...(done && angle.angle !== icp.trim()
          ? { retired_at: new Date().toISOString() }
          : {}),
      })
      .eq("id", angle.id);
  }

  return {
    wanted,
    added,
    cost,
    searches,
    retired,
    reason:
      added === 0 && searches > 0
        ? reason ?? "Every angle returned people already in the pipeline."
        : null,
  };
}
