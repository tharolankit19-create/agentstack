import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/plans";
import { formatRelative } from "@/lib/utils";
import type { Profile } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

/**
 * The owner's view.
 *
 * Deliberately read-only and deliberately small: signups, who paid, and
 * whether agents are actually running. Those are the three numbers that tell
 * you whether the business is alive, and everything beyond them is a
 * dashboard-building project rather than a business-running one.
 *
 * `notFound()` rather than a redirect for a non-admin, so the route does not
 * confirm it exists to anyone who guesses the URL.
 */
export default async function AdminPage() {
  const session = await requireUser("/dashboard/admin");
  if (!isAdmin(session.profile)) notFound();

  // Service role: this is the one page that is supposed to see across users,
  // and RLS would correctly hide all of it from the signed-in client.
  const admin = createAdminClient();

  const [{ data: profiles }, { count: agentCount }, { count: deployedCount }, { count: generationCount }] =
    await Promise.all([
      admin
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50),
      admin.from("agents").select("id", { count: "exact", head: true }),
      admin
        .from("agents")
        .select("id", { count: "exact", head: true })
        .eq("status", "deployed"),
      admin.from("generations").select("id", { count: "exact", head: true }),
    ]);

  const rows = (profiles ?? []) as Profile[];
  const paying = rows.filter((row) => row.plan !== "none" && !row.is_admin);
  const mrr = paying.reduce(
    (sum, row) => sum + (row.plan === "unlimited" ? 149 : row.plan === "pro" ? 59 : 29),
    0,
  );

  return (
    <div className="max-w-5xl space-y-8">
      <header>
        <h1 className="text-3xl font-extrabold text-fg-strong">Admin</h1>
        <p className="mt-2 text-[15px] text-muted">
          Signed in as {session.email}. Read-only.
        </p>
      </header>

      <dl className="grid gap-3 sm:grid-cols-4">
        <Stat label="Signups (last 50 shown)" value={String(rows.length)} />
        <Stat label="Paying" value={String(paying.length)} tone="text-live" />
        <Stat label="MRR from those" value={`$${mrr.toLocaleString()}`} tone="text-live" />
        <Stat
          label="Agents deployed"
          value={`${deployedCount ?? 0} / ${agentCount ?? 0}`}
        />
      </dl>

      <p className="text-sm text-muted">
        {generationCount ?? 0} pieces of work produced by agents, all time.
      </p>

      <section>
        <h2 className="mb-3 text-xl font-bold text-fg-strong">Recent signups</h2>
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-surface-2 text-xs uppercase tracking-wider text-faint">
              <tr>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Plan</th>
                <th className="px-4 py-3 font-semibold">Hosting</th>
                <th className="px-4 py-3 font-semibold">Joined</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 text-fg">
                    {row.email ?? "—"}
                    {row.is_admin ? (
                      <span className="ml-2 rounded-full bg-[var(--accent-wash)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent">
                        admin
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        row.plan === "none" ? "text-muted" : "font-semibold text-live"
                      }
                    >
                      {row.plan}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {row.vercel_connected_at ? row.vercel_account_label : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {formatRelative(row.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "text-fg-strong",
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="rounded-xl border border-line p-4">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={`mt-1 text-2xl font-extrabold tabular-nums ${tone}`}>{value}</dd>
    </div>
  );
}
