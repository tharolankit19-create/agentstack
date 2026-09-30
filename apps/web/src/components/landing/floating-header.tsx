"use client";

import Link from "next/link";
import { ArrowRight, Download } from "lucide-react";
import { LogoLockup } from "@/components/ui/logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { SITE } from "@/lib/site";

export function FloatingHeader({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="fixed inset-x-0 top-3 z-50 px-3">
      <div className="mx-auto flex h-14 max-w-[1220px] items-center justify-between rounded-2xl border border-line bg-surface/96 px-3 shadow-[0_14px_44px_-34px_rgba(10,14,24,.42)] backdrop-blur-xl sm:px-4">
        <Link href="/" aria-label={SITE.name} className="shrink-0">
          <LogoLockup />
        </Link>

        <nav className="hidden items-center gap-1 text-[13px] font-semibold lg:flex">
          <Link className="nav-link" href="/#work">Product</Link>
          <Link className="nav-link" href="/#how">How it works</Link>
          <Link className="nav-link" href="/pricing">Pricing</Link>
        </nav>

        <div className="flex items-center gap-1.5">
          <Link
            href="/download"
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-line bg-surface-2 px-3 text-sm font-bold text-fg-strong transition hover:border-line-strong hover:bg-surface-3"
          >
            <Download className="size-3.5" />
            <span className="hidden min-[380px]:inline">Download</span>
          </Link>

          <ThemeToggle className="hidden md:inline-grid" />

          {signedIn ? (
            <Link href="/dashboard" className="kryx-button kryx-button-primary h-9 px-3.5 text-sm">
              Open Kryx <ArrowRight className="size-4" />
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden rounded-lg px-2.5 py-2 text-sm font-semibold text-fg hover:bg-surface-2 hover:text-fg-strong sm:inline-flex"
              >
                Sign in
              </Link>
              <Link
                href="/login?mode=signup"
                className="kryx-button kryx-button-primary h-9 px-3.5 text-sm"
              >
                Try Kryx <ArrowRight className="size-4" />
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
