"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { LogoLockup } from "@/components/ui/logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { SITE } from "@/lib/site";

export function FloatingHeader({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="fixed inset-x-0 top-3 z-50 px-3">
      <div className="mx-auto flex h-14 max-w-[1180px] items-center justify-between rounded-2xl border border-line-strong bg-surface/95 px-3 shadow-[0_14px_50px_-34px_rgba(16,20,32,.55)] backdrop-blur-xl sm:px-4">
        <Link href="/" aria-label={SITE.name} className="shrink-0">
          <LogoLockup />
        </Link>

        <nav className="hidden items-center gap-1 text-[13px] font-semibold md:flex">
          <Link className="nav-link" href="/#demo">Demo</Link>
          <Link className="nav-link" href="/#team">Agents</Link>
          <Link className="nav-link" href="/#how">How it works</Link>
          <Link className="nav-link" href="/pricing">Pricing</Link>
        </nav>

        <div className="flex items-center gap-1.5">
          <ThemeToggle className="hidden sm:inline-grid" />
          {signedIn ? (
            <Link href="/dashboard" className="kryx-button kryx-button-primary h-9 px-3.5 text-sm">
              Open Kryx <ArrowRight className="size-4" />
            </Link>
          ) : (
            <>
              <Link href="/login" className="hidden px-2.5 py-2 text-sm font-semibold text-muted hover:text-fg-strong sm:inline-flex">
                Sign in
              </Link>
              <Link href="/login?mode=signup" className="kryx-button kryx-button-primary h-9 px-3.5 text-sm">
                Give Kryx a goal <ArrowRight className="size-4" />
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
