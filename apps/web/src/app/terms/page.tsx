import type { Metadata } from "next";
import Link from "next/link";
import { SITE } from "@/lib/site";

export const metadata: Metadata = { title: "Terms" };

/**
 * A starting point, not legal advice. Have a lawyer read this before you take
 * money in a jurisdiction that cares — most do.
 */
export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-16">
      <Link href="/" className="text-sm text-[var(--color-ink-soft)] hover:underline">
        ← {SITE.name}
      </Link>

      <h1 className="mt-6 text-4xl font-extrabold">Terms of service</h1>
      <p className="mt-2 text-sm text-[var(--color-ink-faint)]">
        Last updated {new Date().toISOString().slice(0, 10)}
      </p>

      <div className="mt-10 space-y-8 text-[17px] leading-relaxed text-[var(--color-ink-soft)]">
        <Section title="What you are buying">
          <p>
            A one-time licence to use {SITE.name} and to deploy the number of
            agents included in the plan you paid for. There is no recurring
            charge. We may change the price for new customers at any time; your
            purchase is not affected.
          </p>
        </Section>

        <Section title="Your API keys and your content">
          <p>
            You supply your own model and service API keys. You are responsible
            for what those keys are charged by their providers. Everything your
            agents produce belongs to you. We claim no rights over it and do not
            use it to train anything.
          </p>
        </Section>

        <Section title="What the agents publish">
          <p>
            Agents draft by default. If you enable automatic publishing, you are
            responsible for what is published under your accounts. Review the
            output before you turn publishing on.
          </p>
        </Section>

        <Section title="Acceptable use">
          <p>
            Do not use {SITE.name} to send unsolicited bulk email in violation of
            the laws that apply to you, to impersonate anyone, to generate
            content you know to be false about a real person or company, or to
            scrape a site whose terms forbid it. Accounts doing any of this are
            terminated without a refund.
          </p>
        </Section>

        <Section title="Refunds">
          <p>
            Email within 14 days of purchase and you get a full refund, no
            questions asked. You keep anything your agents already produced.
          </p>
        </Section>

        <Section title="No warranty">
          <p>
            The service is provided as is. Agents call third-party APIs that
            change, rate-limit, and go down. We do not guarantee uptime,
            accuracy, or any business outcome. Our total liability is capped at
            what you paid.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            {SITE.supportEmail ? (
              <>
                Questions go to{" "}
                <a href={`mailto:${SITE.supportEmail}`} className="underline">
                  {SITE.supportEmail}
                </a>
                .
              </>
            ) : (
              "Contact details are published on the homepage footer."
            )}
          </p>
        </Section>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-bold text-[var(--color-ink)]">{title}</h2>
      <div className="mt-2 space-y-3">{children}</div>
    </section>
  );
}
