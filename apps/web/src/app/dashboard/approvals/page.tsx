import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ApprovalDecision } from "@/components/dashboard/approval-decision";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  const session = await requireUser("/dashboard/approvals");
  const admin = createAdminClient();

  const { data: approvals } = await admin
    .from("action_approvals")
    .select("id, action_type, target, description, preview, risk_level, status, created_at")
    .eq("user_id", session.userId)
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="space-y-7">
      <header>
        <h1 className="text-3xl font-extrabold tracking-[-0.02em] text-fg-strong">Approvals</h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted">
          Kryx shows the exact external action before it happens. Level 3 actions always require an explicit decision here.
        </p>
      </header>

      <div className="space-y-3">
        {(approvals ?? []).map((approval) => (
          <article
            id={`approval-${approval.id}`}
            key={approval.id}
            className="rounded-2xl border border-line bg-surface p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-line px-2 py-0.5 text-[11px] font-bold text-muted">
                    Level {approval.risk_level}
                  </span>
                  <span className="text-[12px] font-semibold uppercase tracking-wide text-faint">
                    {approval.action_type}
                  </span>
                </div>
                <h2 className="mt-3 text-[16px] font-bold text-fg-strong">
                  {approval.description}
                </h2>
                {approval.target ? (
                  <p className="mt-1 text-[13px] text-muted">Target: {approval.target}</p>
                ) : null}
              </div>
              {approval.status === "pending" ? (
                <ApprovalDecision id={approval.id} />
              ) : (
                <span className="text-[13px] font-semibold text-muted">{approval.status}</span>
              )}
            </div>

            {approval.preview && Object.keys(approval.preview).length ? (
              <pre className="mt-4 max-h-64 overflow-auto rounded-xl border border-line bg-bg p-3 text-[12px] leading-relaxed text-muted">
                {JSON.stringify(approval.preview, null, 2)}
              </pre>
            ) : null}
          </article>
        ))}

        {!approvals?.length ? (
          <div className="rounded-2xl border border-line bg-surface p-5 text-[14px] text-muted">
            Nothing needs approval.
          </div>
        ) : null}
      </div>
    </div>
  );
}
