import type { Metadata } from "next";
import Link from "next/link";
import { SITE } from "@/lib/site";

export const metadata: Metadata = { title: "Privacy" };

/**
 * A starting point, not legal advice. If you sell into the EU or California,
 * have someone qualified check this before launch.
 */
export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-16">
      <Link href="/" className="text-sm text-[var(--color-ink-soft)] hover:underline">
        ← {SITE.name}
      </Link>

      <h1 className="mt-6 text-4xl font-extrabold">Privacy</h1>
      <p className="mt-2 text-sm text-[var(--color-ink-faint)]">
        Last updated {new Date().toISOString().slice(0, 10)}
      </p>

      <div className="mt-10 space-y-8 text-[17px] leading-relaxed text-[var(--color-ink-soft)]">
        <Section title="What we store">
          <ul className="list-disc space-y-2 pl-5">
            <li>Your email address and the name and avatar your login provider gives us.</li>
            <li>Your plan and a record of your payment. Card details never touch our servers — the payment provider handles those.</li>
            <li>Your agent settings, and everything your agents produce.</li>
            <li>Your API keys, encrypted.</li>
          </ul>
        </Section>

        <Section title="How your API keys are handled">
          <p>
            Keys are encrypted with AES-256-GCM before they are written to the
            database, using a key held only in our server environment. They are
            decrypted once, at deploy time, and written into your own agent&apos;s
            encrypted environment variables. They are never logged, never
            returned to your browser, and never included in what is sent to a
            model.
          </p>
        </Section>

        <Section title="Who else sees your data">
          <p>
            Our hosting and database providers, and the payment provider, as
            processors. Your agents also send the text they are working on to
            whichever model provider your API key belongs to — that is what the
            key is for. We do not sell anything to anyone.
          </p>
        </Section>

        <Section title="Deleting it">
          <p>
            Delete an agent and its settings, keys, output and run history go
            with it. Ask us to delete your account and everything goes, including
            the deployments. Payment records are kept where the law requires it.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            {SITE.supportEmail ? (
              <>
                Data requests go to{" "}
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
