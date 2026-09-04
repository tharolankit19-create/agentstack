import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { DAILY_LEAD_TARGET, DAILY_SEND_CAP, type LeadRow } from "@/lib/pipeline";
import { LeadPipeline } from "@/components/dashboard/lead-pipeline";

export const dynamic = "force-dynamic";

/**
 * The lead pipeline, as the founder's own view of it.
 *
 * This is the page the generalist tools do not have. An assistant that answers
 * questions and files documents is a different product from one that finds
 * named people, judges each against your customer, writes one email per person
 * and holds them until you say send — and that difference is only legible if
 * the founder can see the people.
 *
 * Stages are shown in order with counts, so the shape of the funnel is the
 * page: found, kept, addressed, written, sent. A stage that is empty when the
 * one before it is full is the diagnosis — usually a missing address, which is
 * where real pipelines actually stall.
 */
export default async function LeadsPage() {
  const session = await requireUser("/dashboard/leads");
  const admin = createAdminClient();

  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);

  const [{ data: rows }, { count: foundToday }, { count: sentToday }] = await Promise.all([
    admin
      .from("leads")
      .select("*")
      .eq("user_id", session.userId)
      .neq("stage", "rejected")
      .order("qualify_score", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(200),
    admin
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("user_id", session.userId)
      .gte("created_at", since.toISOString()),
    admin
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("user_id", session.userId)
      .gte("sent_at", since.toISOString()),
  ]);

  return (
    <div className="space-y-7">
      <header>
        <h1 className="text-3xl font-extrabold tracking-[-0.02em] text-fg-strong">Leads</h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted">
          Found, judged against your customer, given an address, written to — one
          email per person, never a template. Nothing sends until you approve it.
        </p>
      </header>

      <LeadPipeline
        leads={(rows ?? []) as LeadRow[]}
        foundToday={foundToday ?? 0}
        sentToday={sentToday ?? 0}
        dailyTarget={DAILY_LEAD_TARGET}
        dailyCap={DAILY_SEND_CAP}
      />
    </div>
  );
}
