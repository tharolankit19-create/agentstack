import Link from "next/link";
import { BuyButton } from "./buy-button";
import { SITE, twitterUrl } from "@/lib/site";
import { PLANS } from "@/lib/plans";

/**
 * 97% of the people who read this will not buy today. They might still send
 * the link to someone. So the last thing on the page is the thing worth
 * repeating — not a sitemap.
 */
export function Footer() {
  const twitter = twitterUrl();

  return (
    <footer className="surface-dark px-5 py-16 sm:py-24">
      <div className="mx-auto max-w-3xl">
        <h2 className="text-3xl font-extrabold leading-[1.1] text-white sm:text-5xl">
          Tomorrow at 9am, one of two things happens.
        </h2>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-white/10 p-5">
            <p className="text-sm font-bold uppercase tracking-wider text-zinc-500">
              Without this
            </p>
            <p className="mt-2 text-[17px] leading-relaxed text-zinc-300">
              You mean to post something. You don&apos;t. Again.
            </p>
          </div>
          <div className="rounded-xl border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 p-5">
            <p className="text-sm font-bold uppercase tracking-wider text-[#c4b5fd]">
              With this
            </p>
            <p className="mt-2 text-[17px] leading-relaxed text-white">
              5 drafts are waiting. You pick 2 and get on with your day.
            </p>
          </div>
        </div>

        <div className="mt-10">
          <BuyButton plan="starter">{PLANS.starter.cta}</BuyButton>
          <p className="mt-3 text-sm text-zinc-500">
            One payment. 3 agents. Live in 90 seconds.
          </p>
        </div>

        <div className="mt-16 flex flex-col gap-6 border-t border-white/10 pt-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="grid size-7 place-items-center rounded-lg bg-[var(--color-accent)] text-xs font-black text-white">
                A
              </span>
              <span className="font-bold text-white">{SITE.name}</span>
            </div>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-zinc-500">
              Built by {SITE.founder}, in public, because doing marketing by hand
              was the worst part of shipping.
            </p>
          </div>

          <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-zinc-400">
            {twitter ? (
              <a
                href={twitter}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-white transition-opacity hover:opacity-70"
              >
                @{SITE.twitterHandle.replace(/^@/, "")}
              </a>
            ) : null}
            {SITE.supportEmail ? (
              <a
                href={`mailto:${SITE.supportEmail}`}
                className="transition-colors hover:text-white"
              >
                Email
              </a>
            ) : null}
            <Link href="/terms" className="transition-colors hover:text-white">
              Terms
            </Link>
            <Link href="/privacy" className="transition-colors hover:text-white">
              Privacy
            </Link>
          </nav>
        </div>

        <p className="mt-8 text-xs text-zinc-600">
          © {new Date().getFullYear()} {SITE.name}. Your agents keep running.
        </p>
      </div>
    </footer>
  );
}
