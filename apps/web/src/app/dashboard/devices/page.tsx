import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { DeviceActions } from "@/components/dashboard/device-actions";

export const dynamic = "force-dynamic";

function liveStatus(lastSeen: string | null, revokedAt: string | null): "Online" | "Offline" | "Revoked" {
  if (revokedAt) return "Revoked";
  if (lastSeen && Date.now() - Date.parse(lastSeen) < 90_000) return "Online";
  return "Offline";
}

export default async function DevicesPage() {
  const session = await requireUser("/dashboard/devices");
  const admin = createAdminClient();

  const { data: devices } = await admin
    .from("devices")
    .select("id, device_name, platform, os_version, app_version, capabilities, permissions, created_at, last_seen_at, revoked_at")
    .eq("user_id", session.userId)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-7">
      <header>
        <h1 className="text-3xl font-extrabold tracking-[-0.02em] text-fg-strong">Devices</h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted">
          Every Kryx computer-use runtime belongs to this same account. Disconnecting a device invalidates its background credentials immediately.
        </p>
      </header>

      <div className="space-y-3">
        {(devices ?? []).map((device) => {
          const status = liveStatus(device.last_seen_at, device.revoked_at);
          const capabilities = Object.entries(device.capabilities ?? {})
            .filter(([, enabled]) => enabled === true)
            .map(([name]) => name.replaceAll("_", " "));

          return (
            <article key={device.id} className="rounded-2xl border border-line bg-surface p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-[16px] font-bold text-fg-strong">{device.device_name}</h2>
                    <span className="rounded-full border border-line px-2 py-0.5 text-[11px] font-semibold text-muted">
                      {status}
                    </span>
                  </div>
                  <p className="mt-1 text-[13px] text-muted">
                    {device.platform === "macos" ? "macOS" : device.platform} · {device.os_version || "OS unknown"} · Kryx {device.app_version || "version unknown"}
                  </p>
                  <p className="mt-1 text-[12px] text-faint">
                    Last seen {device.last_seen_at ? new Date(device.last_seen_at).toLocaleString() : "never"}
                  </p>
                </div>

                <DeviceActions id={device.id} revoked={Boolean(device.revoked_at)} />
              </div>

              <div className="mt-4 flex flex-wrap gap-1.5">
                {capabilities.length ? capabilities.map((capability) => (
                  <span
                    key={capability}
                    className="rounded-md bg-bg px-2 py-1 text-[11px] font-medium text-muted"
                  >
                    {capability}
                  </span>
                )) : (
                  <span className="text-[12px] text-faint">No local capabilities currently reported.</span>
                )}
              </div>
            </article>
          );
        })}

        {!devices?.length ? (
          <div className="rounded-2xl border border-line bg-surface p-5 text-[14px] text-muted">
            No desktop or tablet has been connected yet.
          </div>
        ) : null}
      </div>
    </div>
  );
}
