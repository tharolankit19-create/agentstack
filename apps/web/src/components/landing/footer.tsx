import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Reveal } from "@/components/ui/reveal";
import { LogoLockup } from "@/components/ui/logo";
import { SITE, twitterUrl } from "@/lib/site";

export function Footer() {
  const twitter = twitterUrl();
  return (
    <footer className="border-t border-line bg-bg px-5 py-16 text-fg sm:py-20">
      <div className="mx-auto max-w-5xl">
        <Reveal>
          <div className="grid gap-7 rounded-[28px] border border-line bg-surface p-7 sm:p-9 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <h2 className="text-3xl font-extrabold leading-[1.08] tracking-[-.04em] text-fg-strong sm:text-4xl">Give the outcome to Kryx. Keep the final say.</h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-muted">$0/month. 100 credits included. Add more only when the team is doing paid work.</p>
            </div>
            <Link href="/login?mode=signup" className="kryx-button kryx-button-primary h-12 px-6 text-sm">Start free <ArrowRight className="size-4"/></Link>
          </div>
        </Reveal>

        <div className="mt-12 flex flex-col gap-7 border-t border-line pt-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <LogoLockup />
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">AI Head of Marketing for founders who want execution without another subscription.</p>
          </div>
          <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted">
            <Link href="/demo" className="hover:text-fg-strong">Demo</Link>
            <Link href="/pricing" className="hover:text-fg-strong">Pricing</Link>
            <Link href="/security" className="hover:text-fg-strong">Security</Link>
            <Link href="/privacy" className="hover:text-fg-strong">Privacy</Link>
            <Link href="/terms" className="hover:text-fg-strong">Terms</Link>
            {twitter ? <a href={twitter} target="_blank" rel="noreferrer" className="font-semibold text-fg-strong">@{SITE.twitterHandle.replace(/^@/, "")}</a> : null}
          </nav>
        </div>
        <p className="mt-7 text-xs text-faint">© {new Date().getFullYear()} {SITE.name}.</p>
      </div>
    </footer>
  );
}
