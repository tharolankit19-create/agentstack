import type { Metadata } from "next";
import { Header } from "@/components/landing/header";
import { Footer } from "@/components/landing/footer";
import { getSession } from "@/lib/auth";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Security",
  description: "How KryxAI protects sessions, browser surfaces, API routes and connected data.",
};

const CONTROLS = [
  [
    "Browser hardening",
    "Security headers restrict framing, MIME sniffing, referrer leakage, dangerous browser capabilities and insecure transport.",
  ],
  [
    "Authenticated workspace routes",
    "Dashboard and private API routes are session-gated before application logic runs. Webhooks and machine endpoints authenticate through their own route-specific controls.",
  ],
  [
    "Abuse and cost controls",
    "High-risk and high-cost actions use server-side validation and rate limits so one client cannot freely hammer model or action endpoints.",
  ],
  [
    "Server-side secrets",
    "Private service credentials belong on the server side. UI code should receive only the minimum data needed to render the product.",
  ],
  [
    "Fail closed, then report",
    "Security-sensitive failures should return a clear error rather than silently inventing success. Suspicious behavior is treated as a bug, not a feature.",
  ],
] as const;

export default async function SecurityPage() {
  const session = await getSession().catch(() => null);

  return (
    <>
      <Header signedIn={Boolean(session)} />
      <main className="px-5 pb-20 pt-28 sm:pt-32">
        <div className="mx-auto max-w-5xl">
          <p className="kryx-kicker">Security</p>
          <h1 className="mt-2 max-w-3xl text-4xl font-bold tracking-[-.045em] text-fg-strong sm:text-6xl">
            Built to reduce risk, not pretend risk is zero.
          </h1>
          <p className="mt-5 max-w-2xl text-[16px] leading-7 text-muted">
            No SaaS can truthfully guarantee that it will never be hacked. KryxAI uses layered controls so a single
            mistake is less likely to expose accounts, credentials or user work.
          </p>

          <div className="mt-10 border-t border-line">
            {CONTROLS.map(([title, body], index) => (
              <section key={title} className="grid gap-3 border-b border-line py-6 sm:grid-cols-[44px_220px_1fr]">
                <span className="tnum text-xs text-faint">0{index + 1}</span>
                <h2 className="text-lg font-bold text-fg-strong">{title}</h2>
                <p className="text-sm leading-6 text-muted">{body}</p>
              </section>
            ))}
          </div>

          <section className="mt-10 border-l-2 border-accent pl-5">
            <h2 className="text-lg font-bold text-fg-strong">Responsible disclosure</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              If you find a security issue, do not access data that is not yours and do not intentionally disrupt the
              service.{" "}
              {SITE.supportEmail ? (
                <>
                  Report it to{" "}
                  <a href={`mailto:${SITE.supportEmail}`} className="font-semibold text-fg-strong underline">
                    {SITE.supportEmail}
                  </a>.
                </>
              ) : (
                "Use the support contact published in the footer."
              )}
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
