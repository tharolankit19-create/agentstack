import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { LogoLockup } from "@/components/ui/logo";
import { SITE, twitterUrl } from "@/lib/site";

export function Footer() {
  const twitter = twitterUrl();

  return (
    <footer className="px-5 pb-8 pt-14 sm:pt-20">
      <div className="mx-auto max-w-7xl">
        <div className="rounded-[28px] border border-line-strong bg-fg-strong px-6 py-9 text-bg sm:px-10 sm:py-12">
          <p className="text-[11px] font-bold uppercase tracking-[.14em] opacity-60">The whole pitch</p>
          <div className="mt-4 grid gap-7 lg:grid-cols-[1fr_auto] lg:items-end">
            <h2 className="max-w-3xl text-4xl font-extrabold leading-[.96] tracking-[-.055em] text-bg sm:text-6xl">
              You set the goal. Kryx brings back the work.
            </h2>
            <Link href="/login?mode=signup" className="inline-flex h-12 w-fit items-center gap-2 rounded-xl bg-accent px-5 text-sm font-extrabold text-white">
              Run a mission <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>

        <div className="mt-9 grid gap-8 border-t border-line pt-8 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <LogoLockup />
            <p className="mt-3 max-w-lg text-sm leading-6 text-muted">
              8 identifiable agents. One room. One prepaid balance. One approval queue.
            </p>
          </div>
          <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
            <Link href="/demo" className="hover:text-fg-strong">Demo</Link>
            <Link href="/pricing" className="hover:text-fg-strong">Pricing</Link>
            <Link href="/security" className="hover:text-fg-strong">Security</Link>
            <Link href="/about" className="hover:text-fg-strong">About</Link>
            <Link href="/privacy" className="hover:text-fg-strong">Privacy</Link>
            <Link href="/terms" className="hover:text-fg-strong">Terms</Link>
            {twitter ? <a href={twitter} target="_blank" rel="noreferrer" className="hover:text-fg-strong">@{SITE.twitterHandle.replace(/^@/, "")}</a> : null}
          </nav>
        </div>

        <div className="mt-7 border-t border-line pt-5 text-xs text-faint">
          © {new Date().getFullYear()} {SITE.name}
        </div>
      </div>
    </footer>
  );
}
