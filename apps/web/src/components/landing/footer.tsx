import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { LogoLockup } from "@/components/ui/logo";
import { SITE, twitterUrl } from "@/lib/site";

export function Footer() {
  const twitter = twitterUrl();

  return (
    <footer className="px-5 py-14 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-8 border-b border-line pb-12 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <p className="max-w-3xl text-4xl font-bold leading-[1.02] tracking-[-.045em] text-fg-strong sm:text-6xl">Your marketing should wait for you. <span className="text-accent">Not the other way around.</span></p>
            <p className="mt-5 max-w-xl text-sm leading-6 text-muted">Give Kryx the goal. Review the work when it is ready.</p>
          </div>
          <Link href="/login?mode=signup" className="kryx-button kryx-button-primary h-11 w-fit px-4 text-sm">
            Give Kryx a mission <ArrowRight className="size-4" />
          </Link>
        </div>

        <div className="mt-8 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <LogoLockup />
          <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
            <Link href="/demo" className="hover:text-fg-strong">Demo</Link>
            <Link href="/pricing" className="hover:text-fg-strong">Pricing</Link>
            <Link href="/security" className="hover:text-fg-strong">Security</Link>
            <Link href="/about" className="hover:text-fg-strong">About</Link>
            <Link href="/privacy" className="hover:text-fg-strong">Privacy</Link>
            <Link href="/terms" className="hover:text-fg-strong">Terms</Link>
            {twitter ? <a href={twitter} target="_blank" rel="noreferrer" className="hover:text-fg-strong">@{SITE.twitterHandle.replace(/^@/, "")}</a> : null}
          </nav>
          <p className="text-xs text-faint">© {new Date().getFullYear()} {SITE.name}</p>
        </div>
      </div>
    </footer>
  );
}
