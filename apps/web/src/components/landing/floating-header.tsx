"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { LogoLockup } from "@/components/ui/logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { SITE } from "@/lib/site";

export function FloatingHeader({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-5">
      <div className="pointer-events-auto mx-auto flex h-14 max-w-7xl items-center justify-between rounded-2xl border border-line bg-surface px-3 shadow-[var(--shadow-sm)] sm:px-4">
        <Link href="/" aria-label={SITE.name} className="shrink-0"><LogoLockup /></Link>
        <nav className="hidden items-center gap-1 text-[13px] font-semibold md:flex">
          <Link className="nav-link" href="/#demo">Product demo</Link>
          <Link className="nav-link" href="/#work">How it works</Link>
          <Link className="nav-link" href="/pricing">Pricing</Link>
          <Link className="nav-link" href="/about">About</Link>
        </nav>
        <div className="flex items-center gap-1.5">
          <ThemeToggle className="hidden sm:inline-grid" />
          {signedIn ? (
            <Link href="/dashboard" className="kryx-button kryx-button-primary h-10 px-4 text-sm">Open Kryx <ArrowRight className="size-4" /></Link>
          ) : (
            <><Link href="/login" className="hidden px-3 py-2 text-sm font-semibold text-muted hover:text-fg-strong sm:inline-flex">Sign in</Link><Link href="/login?mode=signup" className="kryx-button kryx-button-primary h-10 px-4 text-sm">Give a mission <ArrowRight className="size-4" /></Link></>
          )}
        </div>
      </div>
    </header>
  );
}
