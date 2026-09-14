import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/landing/header";
import { Footer } from "@/components/landing/footer";
import { getSession } from "@/lib/auth";
import { SITE } from "@/lib/site";

export const metadata: Metadata = { title: "Privacy" };

export default async function PrivacyPage() {
  const session = await getSession().catch(() => null);

  return (
    <>
      <Header signedIn={Boolean(session)} />
      <main className="mx-auto max-w-3xl px-5 pb-20 pt-28 sm:pt-32">
        <p className="kryx-kicker">Legal</p>
        <h1 className="mt-2 text-4xl font-bold tracking-[-.04em] text-fg-strong">Privacy</h1>
        <p className="mt-2 text-sm text-faint">Last updated 2026-09-14</p>

        <div className="mt-10 space-y-9 text-[16px] leading-7 text-muted">
          <Section title="What we store">
            <p>
              We store the account information needed to run KryxAI, workspace configuration, generated work,
              approvals, usage and credit records, and the settings for services you connect.
            </p>
          </Section>

          <Section title="Connected services and credentials">
            <p>
              When you connect a service, credentials are handled by server-side code and are used only to perform
              the work you request. We do not intentionally place private credentials into public pages, analytics
              events or model prompts.
            </p>
          </Section>

          <Section title="AI and tool providers">
            <p>
              To perform a task, KryxAI may send the minimum task context needed to the model, search, enrichment,
              email, analytics or other provider used for that job. Those providers process data under their own
              terms and privacy policies.
            </p>
          </Section>

          <Section title="Payments">
            <p>
              Payment card details are handled by the payment provider rather than stored directly by KryxAI. We keep
              the billing and credit records needed to operate the account and meet legal requirements.
            </p>
          </Section>

          <Section title="Deletion and retention">
            <p>
              You can ask us to delete your account and workspace data. Some billing, fraud-prevention or security
              records may need to be retained when the law or legitimate security needs require it.
            </p>
          </Section>

          <Section title="Security">
            <p>
              No internet service can honestly promise that it can never be compromised. We use layered controls and
              publish the current security posture on the{" "}
              <Link href="/security" className="font-semibold text-fg-strong underline">Security page</Link>.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              {SITE.supportEmail ? (
                <>
                  Privacy and data requests:{" "}
                  <a href={`mailto:${SITE.supportEmail}`} className="underline">{SITE.supportEmail}</a>.
                </>
              ) : (
                "Contact details are published in the site footer when support email is configured."
              )}
            </p>
          </Section>
        </div>
      </main>
      <Footer />
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-bold text-fg-strong">{title}</h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}
