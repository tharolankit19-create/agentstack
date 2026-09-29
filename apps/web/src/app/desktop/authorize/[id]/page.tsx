import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { DesktopAuthorizeButton } from "@/components/auth/desktop-authorize-button";

export const dynamic = "force-dynamic";

export default async function DesktopAuthorizePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const admin = createAdminClient();

  const { data: request } = await admin
    .from("desktop_auth_requests")
    .select("id, device_name, platform, os_version, app_version, expires_at, consumed_at")
    .eq("id", id)
    .maybeSingle<{
      id: string;
      device_name: string;
      platform: string;
      os_version: string | null;
      app_version: string | null;
      expires_at: string;
      consumed_at: string | null;
    }>();

  if (!request || request.consumed_at || Date.parse(request.expires_at) <= Date.now()) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-bg px-5 py-16 text-fg">
      <section className="mx-auto max-w-md rounded-2xl border border-line bg-surface p-6 shadow-sm">
        <p className="microlabel">Kryx Desktop</p>
        <h1 className="mt-3 text-3xl font-extrabold tracking-[-.04em] text-fg-strong">
          Connect this computer
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          This gives the Kryx app on this device access to your existing Kryx account.
          It does not share your Google password or browser cookies with the desktop app.
        </p>

        <dl className="mt-6 divide-y divide-line rounded-xl border border-line">
          <div className="flex justify-between gap-5 px-4 py-3">
            <dt className="text-sm text-muted">Device</dt>
            <dd className="text-sm font-semibold text-fg-strong">{request.device_name}</dd>
          </div>
          <div className="flex justify-between gap-5 px-4 py-3">
            <dt className="text-sm text-muted">Platform</dt>
            <dd className="text-sm font-semibold text-fg-strong">
              {request.platform === "macos" ? "macOS" : request.platform}
            </dd>
          </div>
          {request.os_version ? (
            <div className="flex justify-between gap-5 px-4 py-3">
              <dt className="text-sm text-muted">System</dt>
              <dd className="text-sm font-semibold text-fg-strong">{request.os_version}</dd>
            </div>
          ) : null}
        </dl>

        <div className="mt-6">
          <DesktopAuthorizeButton requestId={request.id} />
        </div>

        <p className="mt-4 text-xs leading-5 text-faint">
          You can disconnect this device later from Kryx settings. Device access is revocable and uses short-lived credentials.
        </p>
      </section>
    </main>
  );
}
