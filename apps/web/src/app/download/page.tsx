import Link from "next/link";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { DownloadChoices } from "@/components/download/download-choices";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

function releaseUrl(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export default async function DownloadPage() {
  await requireUser("/download");
  const macUrl =
    releaseUrl(process.env.NEXT_PUBLIC_KRYX_MAC_DOWNLOAD_URL) ??
    "https://github.com/tharolankit19-create/agentstack/releases/download/kryx-device-latest/Kryx-Mac-1.2.0-preview.dmg";
  const androidUrl =
    releaseUrl(process.env.NEXT_PUBLIC_KRYX_ANDROID_APK_URL) ??
    "https://github.com/tharolankit19-create/agentstack/releases/download/kryx-device-latest/Kryx-Tablet-1.2.0-dev-signed.apk";

  return (
    <main className="min-h-screen bg-bg px-5 py-10 text-fg sm:py-16">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-bold text-muted hover:text-fg-strong"
        >
          <ArrowLeft className="size-4" />
          Kryx
        </Link>

        <div className="mt-14 max-w-3xl">
          <p className="microlabel">Kryx on your computer</p>
          <h1 className="mt-3 text-5xl font-extrabold leading-[.96] tracking-[-.06em] text-fg-strong sm:text-7xl">
            Your marketing agents can work where you already work.
          </h1>
          <p className="mt-6 max-w-2xl text-[16px] leading-7 text-muted">
            Same Kryx account, agents, missions, credits, approvals and history. The device app adds local browser and computer execution without creating a second identity.
          </p>
        </div>

        <div className="mt-10">
          <DownloadChoices
            macUrl={macUrl}
            androidUrl={androidUrl}
            macVersion={process.env.NEXT_PUBLIC_KRYX_MAC_VERSION?.trim() || "1.2.0"}
            androidVersion={process.env.NEXT_PUBLIC_KRYX_ANDROID_VERSION?.trim() || "1.2.0"}
            macSize={process.env.NEXT_PUBLIC_KRYX_MAC_SIZE?.trim() || null}
            androidSize={process.env.NEXT_PUBLIC_KRYX_ANDROID_SIZE?.trim() || null}
          />
        </div>

        <section className="mt-12 grid gap-4 lg:grid-cols-3">
          {[
            [
              "1. Sign in",
              "Continue with Google in your browser. Kryx resolves the same account used by the web app.",
            ],
            [
              "2. Grant only what is needed",
              "Browser, Accessibility and app permissions are separate. You can revoke the device from the web dashboard.",
            ],
            [
              "3. Run a real mission",
              "Start with competitor research. Kryx returns source-backed evidence and stops for verification or approval when required.",
            ],
          ].map(([title, body]) => (
            <article key={title} className="rounded-2xl border border-line bg-surface p-5">
              <CheckCircle2 className="size-5 text-accent" />
              <h2 className="mt-4 text-lg font-extrabold text-fg-strong">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted">{body}</p>
            </article>
          ))}
        </section>

        <section className="mt-12 rounded-[24px] border border-line bg-surface p-6 sm:p-8">
          <h2 className="text-2xl font-extrabold tracking-[-.035em] text-fg-strong">
            Android direct-install guide
          </h2>
          <ol className="mt-5 space-y-3 text-sm leading-6 text-muted">
            <li>1. Download the APK on the tablet.</li>
            <li>2. Allow installation from your browser/files app when Android asks.</li>
            <li>3. Open Kryx and sign in with the same Kryx account.</li>
            <li>4. Enable Accessibility only after reading the permission explanation.</li>
            <li>5. Choose which apps Kryx may operate. The default allow-list is empty.</li>
          </ol>
          <p className="mt-5 text-xs leading-5 text-faint">
            Direct APK distribution is the initial Android channel. Play Store distribution requires a separate AccessibilityService policy review and may use a more constrained execution mode.
          </p>
        </section>
      </div>
    </main>
  );
}
