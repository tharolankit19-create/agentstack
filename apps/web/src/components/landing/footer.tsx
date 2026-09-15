import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { LogoLockup } from "@/components/ui/logo";
import { SITE, twitterUrl } from "@/lib/site";

export function Footer() {
  const twitter = twitterUrl();

  return (
    <footer className="px-5 py-12 sm:py-16">
      <div className="mx-auto max-w-6xl">
        <div className="rounded-[24px] bg-fg-strong px-5 py-8 text-bg sm:px-8 sm:py-10">
          <p className="text-xs font-bold uppercase tracking-[.13em] opacity-60">KryxAI</p>
          <div className="mt-3 grid gap-6 sm:grid-cols-[1fr_auto] sm:items-end">
            <h2 className="max-w-3xl text-4xl font-extrabold tracking-[-.045em] text-bg sm:text-6xl">
              Give Kryx the goal. Keep building.
            </h2>
            <Link href="/login?mode=signup" className="inline-flex h-12 w-fit items-center gap-2 rounded-xl bg-accent px-5 text-sm font-bold text-white">
              Give Kryx a goal <ArrowRight className="size-4" />
            </Link>
          </div>
          <p className="mt-5 max-w-2xl text-sm leading-6 opacity-65">
            8 specialist agents · 100 free credits · no monthly subscription
          </p>
        </div>

        <div className="mt-9 flex flex-col gap-7 border-t border-line pt-7 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <LogoLockup />
            <p className="mt-3 max-w-lg text-sm leading-6 text-muted">
              Finished marketing work with evidence. The founder keeps the final say.
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
        <p className="mt-6 text-xs text-faint">© {new Date().getFullYear()} {SITE.name}</p>
      </div>
    </footer>
  );
}
