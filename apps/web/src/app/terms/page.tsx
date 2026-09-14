import type { Metadata } from "next";
import { Header } from "@/components/landing/header";
import { Footer } from "@/components/landing/footer";
import { getSession } from "@/lib/auth";
import { SITE } from "@/lib/site";

export const metadata: Metadata = { title: "Terms" };

export default async function TermsPage() {
  const session = await getSession().catch(() => null);

  return (
    <>
      <Header signedIn={Boolean(session)} />
      <main className="mx-auto max-w-3xl px-5 pb-20 pt-28 sm:pt-32">
        <p className="kryx-kicker">Legal</p>
        <h1 className="mt-2 text-4xl font-bold tracking-[-.04em] text-fg-strong">Terms of service</h1>
        <p className="mt-2 text-sm text-faint">Last updated 2026-09-14</p>

        <div className="mt-10 space-y-9 text-[16px] leading-7 text-muted">
          <Section title="The service">
            <p>
              {SITE.name} provides an AI marketing workspace that can coordinate research, content, SEO,
              conversion and pipeline work. The product may use third-party models, data providers and connected
              services to perform work you request.
            </p>
          </Section>

          <Section title="Credits and billing">
            <p>
              KryxAI has no monthly seat fee in the current pay-as-you-go offering. Specialist work consumes credits
              according to the prices shown in the product. Purchased credits do not expire under the current
              offering. Checkout terms and any rights required by applicable law control refund eligibility.
            </p>
          </Section>

          <Section title="Your accounts and connected services">
            <p>
              You are responsible for keeping access to your account secure and for having permission to connect any
              third-party account, domain, inbox, analytics property or other service you give KryxAI access to.
            </p>
          </Section>

          <Section title="Your content and approvals">
            <p>
              You remain responsible for material published or sent through accounts you control. Review consequential
              actions before approving them. KryxAI may produce incorrect, incomplete or outdated output, so do not
              treat generated work as a substitute for your own judgment where accuracy matters.
            </p>
          </Section>

          <Section title="Acceptable use">
            <p>
              Do not use {SITE.name} to break applicable law, impersonate people, compromise accounts, distribute
              malware, send unlawful unsolicited bulk messages, or collect data you are not permitted to collect.
              We may suspend abusive use to protect users and the service.
            </p>
          </Section>

          <Section title="Third-party services">
            <p>
              Models, search providers, enrichment services, payment processors and connected platforms are operated
              by third parties. Their availability, limits and terms can change independently of KryxAI.
            </p>
          </Section>

          <Section title="No guaranteed outcome">
            <p>
              The service is provided on an as-available basis. We do not guarantee uninterrupted availability,
              perfect accuracy, search rankings, leads, revenue or any other business result.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              {SITE.supportEmail
                ? <>Questions: <a href={`mailto:${SITE.supportEmail}`} className="underline">{SITE.supportEmail}</a>.</>
                : "Contact details are published in the site footer when support email is configured."}
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
