import type { Metadata } from "next";
import Link from "next/link";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy",
  description: "How KryxAI handles account, workspace, connected-service and billing data.",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-16 sm:py-20">
      <Link href="/" className="text-sm text-muted hover:text-fg-strong">← {SITE.name}</Link>
      <h1 className="mt-6 text-4xl font-extrabold tracking-[-.04em] text-fg-strong">Privacy</h1>
      <p className="mt-2 text-sm text-faint">Last updated September 14, 2026</p>

      <div className="mt-10 space-y-9 text-[16px] leading-7 text-muted">
        <Section title="What we collect">
          <p>We process the account information needed to sign you in, the company context you give Kryx, your agent settings, messages, generated work, approvals, schedules, credit balance and usage records.</p>
          <p>When you connect another service, we process the data that connection makes available only to provide the workflows you asked for.</p>
        </Section>
        <Section title="Analytics and operational data">
          <p>We use privacy-friendly product analytics and hosting telemetry to understand visits, performance and failures. We do not use those systems to sell personal information to advertisers.</p>
        </Section>
        <Section title="AI providers">
          <p>To produce a result, relevant prompt text and workspace context may be sent to the model provider selected by KryxAI's routing system. We try to send only the context needed for the task. Payment details and stored secrets are not intentionally included in model prompts.</p>
        </Section>
        <Section title="Billing">
          <p>Payment processing is handled by the payment provider shown at checkout. KryxAI stores the records needed to reconcile purchases and credits, but should not receive your full card number from the payment processor.</p>
        </Section>
        <Section title="Security">
          <p>We use server-side authorization checks, scoped access, secure transport and defensive browser headers. No internet service can promise zero risk, so we also design sensitive actions to require explicit authorization where practical.</p>
          <p><Link href="/security" className="font-semibold text-fg-strong underline">Read the security overview</Link>.</p>
        </Section>
        <Section title="Retention and deletion">
          <p>We keep data for as long as it is needed to provide the service, resolve security or billing issues, or meet legal obligations. You can request account deletion or data access using the contact below.</p>
        </Section>
        <Section title="Contact">
          <p>{SITE.supportEmail ? <>Privacy and data requests: <a href={`mailto:${SITE.supportEmail}`} className="underline">{SITE.supportEmail}</a>.</> : "Use the support contact published on the KryxAI website for privacy and data requests."}</p>
        </Section>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section><h2 className="text-xl font-bold text-fg-strong">{title}</h2><div className="mt-2 space-y-3">{children}</div></section>;
}
