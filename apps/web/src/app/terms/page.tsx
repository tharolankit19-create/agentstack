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
      <Link href="/" className="text-sm text-muted hover:underline">
        ← {SITE.name}
      </Link>

      <h1 className="mt-6 text-4xl font-extrabold">Terms of service</h1>
      <p className="mt-2 text-sm text-faint">
        Last updated {new Date().toISOString().slice(0, 10)}
      </p>

      <div className="mt-10 space-y-8 text-[17px] leading-relaxed text-muted">
        <Section title="What you are buying">
          <p>
            A monthly subscription to {SITE.name}, which lets you run up to the
            number of agents included in your plan. It renews every month until
            you cancel. We may change the price for new customers at any time;
            your price does not change while your subscription is active.
          </p>
        </Section>

        <Section title="Cancelling">
          <p>
            Cancel any time from your dashboard. Your agents keep running until
            the end of the period you have already paid for, then stop. Nothing
            you produced is deleted — your configuration and everything your
            agents made stay in your account, and resubscribing turns them all
            back on.
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
            Email within 14 days of your first charge and you get that month
            refunded, no questions asked. After that, cancelling stops the next
            charge rather than refunding the current one.
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
      <h2 className="text-xl font-bold text-fg">{title}</h2>
      <div className="mt-2 space-y-3">{children}</div>
    </section>
  );
}
