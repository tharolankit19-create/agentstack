import type { LeadRow } from "@/lib/pipeline";

/**
 * The funnel, and the people in it.
 *
 * Two things, in this order: the shape of the pipeline, then the rows. The
 * shape first because it answers the question a founder opens this page with —
 * is it working — in one glance, and because a stage that has emptied while the
 * one before it filled is a diagnosis they can act on without reading a single
 * name.
 */

const STAGES = [
  { id: "found", label: "Found", note: "Matched your customer" },
  { id: "qualified", label: "Kept", note: "Worth writing to" },
  { id: "enriched", label: "Addressed", note: "Email found" },
  { id: "written", label: "Written", note: "Waiting on you" },
  { id: "approved", label: "Approved", note: "Going out" },
  { id: "sent", label: "Sent", note: "Gone" },
] as const;

export function LeadPipeline({
  leads,
  foundToday,
  sentToday,
  dailyTarget,
  dailyCap,
}: {
  leads: LeadRow[];
  foundToday: number;
  sentToday: number;
  dailyTarget: number;
  dailyCap: number;
}) {
  const counts = new Map<string, number>();
  for (const lead of leads) counts.set(lead.stage, (counts.get(lead.stage) ?? 0) + 1);

  const failed = leads.filter((l) => l.stage === "failed");
  const waiting = leads.filter((l) => l.stage === "written");
  const rest = leads.filter((l) => !["failed", "written"].includes(l.stage));

  return (
    <div className="space-y-7">
      <div className="grid gap-3 sm:grid-cols-2">
        <Meter
          label="Found today"
          value={foundToday}
          target={dailyTarget}
          note={`Target is ${dailyTarget} a day. They arrive through the day, not at once.`}
        />
        <Meter
          label="Sent today"
          value={sentToday}
          target={dailyCap}
          note={`Capped at ${dailyCap}. A burst from a new domain is what gets sending blocked.`}
        />
      </div>

      <section className="overflow-hidden rounded-xl border border-line">
        <p className="border-b border-line bg-surface-2 px-5 py-3 text-sm font-semibold text-fg-strong">
          Where everyone is
        </p>
        <ul className="divide-y divide-line">
          {STAGES.map((stage) => (
            <li key={stage.id} className="flex items-baseline gap-4 px-5 py-3">
              <span className="w-24 shrink-0 text-[15px] font-semibold text-fg-strong">
                {stage.label}
              </span>
              <span className="w-12 shrink-0 text-[15px] font-bold tabular-nums text-fg">
                {counts.get(stage.id) ?? 0}
              </span>
              <span className="text-[13px] text-muted">{stage.note}</span>
            </li>
          ))}
          {failed.length ? (
            <li className="flex items-baseline gap-4 bg-surface-2 px-5 py-3">
              <span className="w-24 shrink-0 text-[15px] font-semibold text-muted">Stuck</span>
              <span className="w-12 shrink-0 text-[15px] font-bold tabular-nums text-muted">
                {failed.length}
              </span>
              <span className="text-[13px] text-muted">
                Mostly no address found. They are kept, not deleted.
              </span>
            </li>
          ) : null}
        </ul>
      </section>

      {waiting.length ? (
        <section>
          <h2 className="text-[17px] font-bold text-fg-strong">
            {waiting.length} written and waiting on you
          </h2>
          <ul className="mt-3 space-y-2">
            {waiting.slice(0, 20).map((lead) => (
              <li key={lead.id} className="rounded-xl border border-accent-line bg-accent-wash p-4">
                <p className="text-[15px] font-semibold text-fg-strong">
                  {lead.email_subject || "Cold email"}
                </p>
                <p className="mt-0.5 text-[13px] text-muted">
                  {[lead.full_name, lead.title, lead.company].filter(Boolean).join(" · ")}
                  {lead.email ? ` · ${lead.email}` : " · no address yet"}
                </p>
                {lead.email_body ? (
                  <p className="mt-2 whitespace-pre-line text-[14px] leading-relaxed text-fg">
                    {lead.email_body.slice(0, 400)}
                  </p>
                ) : null}
                {lead.qualify_reason ? (
                  <p className="mt-2 text-[12.5px] text-faint">Why them: {lead.qualify_reason}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {rest.length ? (
        <section>
          <h2 className="text-[17px] font-bold text-fg-strong">Everyone else</h2>
          <div className="mt-3 overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[640px] text-left text-[14px]">
              <thead className="border-b border-line bg-surface-2 text-[13px] text-muted">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Name</th>
                  <th className="px-4 py-2.5 font-semibold">Company</th>
                  <th className="px-4 py-2.5 font-semibold">Stage</th>
                  <th className="px-4 py-2.5 font-semibold">Fit</th>
                  <th className="px-4 py-2.5 font-semibold">Why</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rest.slice(0, 100).map((lead) => (
                  <tr key={lead.id}>
                    <td className="px-4 py-2.5 font-medium text-fg-strong">
                      {lead.full_name ?? "—"}
                      {lead.title ? (
                        <span className="block text-[12.5px] font-normal text-muted">
                          {lead.title}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-2.5 text-muted">{lead.company ?? "—"}</td>
                    <td className="px-4 py-2.5 text-muted">{lead.stage}</td>
                    <td className="px-4 py-2.5 tabular-nums text-muted">
                      {lead.qualify_score ?? "—"}
                    </td>
                    <td className="max-w-[280px] truncate px-4 py-2.5 text-muted">
                      {lead.qualify_reason ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <p className="rounded-xl border border-dashed border-line px-5 py-10 text-center text-[15px] text-muted">
          No leads yet. They arrive on the pipeline&rsquo;s own schedule — or ask
          your head agent on Telegram for ten right now.
        </p>
      )}
    </div>
  );
}

/**
 * Progress against a target that is a promise, not a limit — and against one
 * that is a limit, not a promise. Same shape, because the founder reads them
 * together; the difference is entirely in the note underneath.
 */
function Meter({
  label,
  value,
  target,
  note,
}: {
  label: string;
  value: number;
  target: number;
  note: string;
}) {
  const pct = Math.min(100, Math.round((value / Math.max(target, 1)) * 100));

  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <p className="flex items-baseline justify-between text-sm font-semibold text-muted">
        {label}
        <span className="text-2xl font-extrabold tabular-nums text-fg-strong">{value}</span>
      </p>
      <div
        className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-3"
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={target}
        aria-label={label}
      >
        <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2.5 text-[12.5px] leading-snug text-faint">{note}</p>
    </div>
  );
}
