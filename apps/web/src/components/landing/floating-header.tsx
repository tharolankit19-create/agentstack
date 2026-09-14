"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { LogoLockup } from "@/components/ui/logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { SITE } from "@/lib/site";

export function FloatingHeader({ signedIn }: { signedIn: boolean }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 28);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-50 px-4 pt-3 sm:px-6 sm:pt-4">
      <div
        className={`pointer-events-auto mx-auto flex max-w-5xl items-center justify-between rounded-[22px] border border-black/[.08] bg-white/72 px-3.5 shadow-[0_18px_70px_-34px_rgba(15,23,42,.34)] backdrop-blur-2xl transition-all duration-300 dark:border-white/[.10] dark:bg-black/60 sm:px-4 ${scrolled ? "h-14 translate-y-0.5" : "h-16"}`}
      >
        <Link href="/" aria-label={SITE.name} className="shrink-0">
          <LogoLockup />
        </Link>

        <nav className="hidden items-center gap-1 text-[13px] font-semibold md:flex">
          <Link className="nav-pill" href="/#demo">Demo</Link>
          <Link className="nav-pill" href="/#how">How it works</Link>
          <Link className="nav-pill" href="/pricing">Pricing</Link>
          <Link className="nav-pill" href="/security">Security</Link>
        </nav>

        <div className="flex items-center gap-1.5">
          <ThemeToggle className="hidden sm:inline-flex" />
          {signedIn ? (
            <Link href="/dashboard" className="kryx-button kryx-button-primary h-10 px-4 text-sm">
              Open Kryx <ArrowRight className="size-4" />
            </Link>
          ) : (
            <>
              <Link href="/login" className="hidden rounded-xl px-3 py-2 text-sm font-semibold text-muted transition hover:text-fg-strong sm:inline-flex">
                Sign in
              </Link>
              <Link href="/login?mode=signup" className="kryx-button kryx-button-primary h-10 px-4 text-sm">
                Start free <ArrowRight className="size-4" />
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
