import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { LogoLockup } from "@/components/ui/logo";
import { SITE, twitterUrl } from "@/lib/site";

export function Footer() {
  const twitter = twitterUrl();

  return (
    <footer className="px-5 pb-8 pt-14 sm:pt-20">
      <div className="mx-auto max-w-7xl">
        <div className="mt-4 grid gap-8 border-t border-line pt-8 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <LogoLockup />
            <p className="mt-3 max-w-lg text-sm leading-6 text-muted">
              The founder&apos;s agent army: one goal, the right specialists,
              clear approvals and finished work across web, tools and devices.
            </p>
          </div>

          <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
            <Link href="/docs" className="hover:text-fg-strong">Docs</Link>
            <Link href="/pricing" className="hover:text-fg-strong">Pricing</Link>
            <Link href="/download" className="hover:text-fg-strong">Download</Link>
            <Link href="/security" className="hover:text-fg-strong">Security</Link>
            <Link href="/about" className="hover:text-fg-strong">About</Link>
            <Link href="/privacy" className="hover:text-fg-strong">Privacy</Link>
            <Link href="/terms" className="hover:text-fg-strong">Terms</Link>
            {twitter ? (
              <a href={twitter} target="_blank" rel="noreferrer" className="hover:text-fg-strong">
                @{SITE.twitterHandle.replace(/^@/, "")}
              </a>
            ) : null}
          </nav>
        </div>

        <div className="mt-7 flex flex-col gap-3 border-t border-line pt-5 text-xs text-faint sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} {SITE.name}</span>
          <Link href="/login?mode=signup" className="inline-flex items-center gap-1.5 font-bold text-fg-strong">
            Start with 100 free credits <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </div>
    </footer>
  );
}
