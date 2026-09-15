import { requireUser } from "@/lib/auth";
import { hostingStatus } from "@/lib/user-hosting";
import { isAdmin } from "@/lib/plans";
import { HostingCard } from "@/components/dashboard/hosting-card";
import { TelegramCard } from "@/components/dashboard/telegram-card";

export const dynamic = "force-dynamic";

/**
 * Settings — the one place a founder re-authenticates everything.
 *
 * This page exists because the connections that a running product depends on —
 * the optional hosting account and Telegram delivery channel can expire,
 * get revoked, or move, and there was nowhere to fix them without starting over.
 * that without deleting and starting over. Each of those used to surface only
 * as a card that appeared when something was already broken. Here they are
 * permanent and editable, whether or not anything is wrong.
 */
export default async function SettingsPage() {
  const session = await requireUser("/dashboard/settings");
  const hosting = hostingStatus(session.profile);
  const admin = isAdmin(session.profile);

  return (
    <div className="max-w-3xl space-y-8">
      <header>
        <h1 className="text-3xl font-extrabold text-fg-strong">Settings</h1>
        <p className="mt-2 text-[15px] text-muted">
          Your account and the few preferences Kryx needs to keep working.
        </p>
      </header>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-bold text-fg-strong">Profile</h2>
          <p className="text-sm text-muted">Who you are signed in as.</p>
        </div>
        <div className="rounded-2xl border border-line bg-surface-2 p-5">
          <dl className="space-y-2 text-sm">
            <Row label="Email" value={session.email} />
            <Row
              label="Name"
              value={session.profile.full_name || "—"}
            />
            <Row
              label="Plan"
              value={
                admin
                  ? "Admin — everything unlocked"
                  : session.profile.plan === "none"
                    ? "Pay as you go"
                    : `${session.profile.plan} plan`
              }
            />
          </dl>
        </div>
      </section>

      {admin ? (
        <>
          {hosting.selfHosted ? (
            <section className="space-y-3">
              <div>
                <h2 className="text-lg font-bold text-fg-strong">Operator hosting</h2>
                <p className="text-sm text-muted">
                  Internal deployment connection for custom runtimes.
                </p>
              </div>
              <HostingCard initial={hosting} />
            </section>
          ) : null}
        </>
      ) : null}

      {/* Where the head agent reports. */}
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-bold text-fg-strong">Telegram</h2>
          <p className="text-sm text-muted">
            Where your head agent messages you. Connect, swap, or disconnect.
          </p>
        </div>
        <TelegramCard />
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap gap-x-4">
      <dt className="w-24 shrink-0 text-muted">{label}</dt>
      <dd className="min-w-0 flex-1 font-semibold text-fg-strong">{value}</dd>
    </div>
  );
}
