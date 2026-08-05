import Link from "next/link";
import { SignupButton } from "./signup-button";
import { Reveal } from "@/components/ui/reveal";
import { SITE, twitterUrl } from "@/lib/site";
import { TOTAL_MONTHLY_REPLACED, formatUsd } from "@/lib/templates";

/**
 * Most people who read this will not subscribe today. They might still send
 * the link to someone. So the last thing on the page is the thing worth
 * repeating — not a sitemap.
 */
export function Footer() {
  const twitter = twitterUrl();

  return (
    <footer className="bg-bg text-fg px-5 py-16 sm:py-24">
      <div className="mx-auto max-w-3xl">
        <Reveal>
          <h2 className="text-3xl font-extrabold leading-[1.1] text-fg-strong sm:text-5xl">
            On the 4th of next month, twelve companies charge your card.
          </h2>
        </Reveal>

        <Reveal delay={80}>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-line p-5">
              <p className="text-sm font-bold uppercase tracking-wider text-muted">
                Change nothing
              </p>
              <p className="mt-2 text-[17px] leading-relaxed text-muted">
                {formatUsd(TOTAL_MONTHLY_REPLACED)} leaves your account. You open
                three of them.
              </p>
            </div>
            <div className="rounded-xl border border-accent/40 bg-accent/10 p-5">
              <p className="text-sm font-bold uppercase tracking-wider text-accent">
                Change one thing
              </p>
              <p className="mt-2 text-[17px] leading-relaxed text-fg-strong">
                $29 leaves your account. The work is already done when you wake up.
              </p>
            </div>
          </div>
        </Reveal>

        <Reveal delay={160}>
          <div className="mt-10">
            <SignupButton>Cancel my first 3 subscriptions</SignupButton>
            <p className="mt-3 text-sm text-muted">
              $29/month. Cancel in one click. Keep everything your agents made.
            </p>
          </div>
        </Reveal>

        <div className="mt-16 flex flex-col gap-6 border-t border-line pt-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="grid size-7 place-items-center rounded-lg bg-accent text-xs font-black text-accent-fg">
                A
              </span>
              <span className="font-bold text-fg-strong">{SITE.name}</span>
            </div>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">
              Built by {SITE.founder}, in public, after adding up a year of
              subscriptions for tools that each did one thing.
            </p>
          </div>

          <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted">
            {twitter ? (
              <a
                href={twitter}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-fg-strong transition-opacity hover:opacity-70"
              >
                @{SITE.twitterHandle.replace(/^@/, "")}
              </a>
            ) : null}
            {SITE.supportEmail ? (
              <a
                href={`mailto:${SITE.supportEmail}`}
                className="transition-colors hover:text-fg-strong"
              >
                Email
              </a>
            ) : null}
            <Link href="/terms" className="transition-colors hover:text-fg-strong">
              Terms
            </Link>
            <Link href="/privacy" className="transition-colors hover:text-fg-strong">
              Privacy
            </Link>
          </nav>
        </div>

        <p className="mt-8 text-xs text-faint">
          © {new Date().getFullYear()} {SITE.name}. Your agents keep running.
        </p>
      </div>
    </footer>
  );
}
