import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, LockKeyhole, ShieldCheck, UserCheck } from "lucide-react";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Security",
  description: "KryxAI security design, access controls and responsible disclosure.",
};

const controls = [
  [ShieldCheck, "Scoped access", "Workspace data is accessed through authenticated server routes and user-scoped queries rather than trusting browser input."],
  [UserCheck, "Founder approvals", "Publishing, outbound messages, repository writes and other consequential actions are designed to stay approval-gated by default."],
  [LockKeyhole, "Secrets stay server-side", "Provider and connector secrets belong in server environment variables or protected storage, not in client bundles or model prompts."],
  [CheckCircle2, "Defensive defaults", "The app sets browser hardening headers, blocks framing, restricts referrer leakage and disables unused browser capabilities."],
] as const;

export default function SecurityPage() {
  return (
    <main className="mx-auto max-w-5xl px-5 py-16 sm:py-20">
      <Link href="/" className="text-sm text-muted hover:text-fg-strong">← {SITE.name}</Link>
      <div className="mt-8 max-w-3xl">
        <p className="text-xs font-bold uppercase tracking-[.18em] text-accent">Security</p>
        <h1 className="mt-3 text-4xl font-extrabold tracking-[-.045em] text-fg-strong sm:text-6xl">Built to limit blast radius.</h1>
        <p className="mt-5 text-[17px] leading-7 text-muted">KryxAI connects agents to real work, so the safe default is least privilege, explicit approvals and server-side enforcement. This page describes the current design goals; it is not a claim that any internet service is impossible to compromise.</p>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {controls.map(([Icon, title, body]) => (
          <section key={title} className="rounded-[22px] border border-line bg-surface p-6">
            <span className="grid size-10 place-items-center rounded-xl bg-accent-wash text-accent"><Icon className="size-5"/></span>
            <h2 className="mt-4 text-lg font-bold text-fg-strong">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">{body}</p>
          </section>
        ))}
      </div>

      <section className="mt-10 rounded-[24px] border border-line bg-surface p-6 sm:p-8">
        <h2 className="text-xl font-bold text-fg-strong">Responsible disclosure</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">If you find a security issue, do not access data that is not yours and do not disrupt the service. Send the minimum information needed to reproduce the issue to {SITE.supportEmail ? <a href={`mailto:${SITE.supportEmail}`} className="font-semibold text-fg-strong underline">{SITE.supportEmail}</a> : "the support address listed on the site"}.</p>
      </section>
    </main>
  );
}
