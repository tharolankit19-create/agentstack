"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { SITE } from "@/lib/site";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { LogoLockup } from "@/components/ui/logo";
import { cn } from "@/lib/utils";

export function Header({ signedIn }: { signedIn: boolean }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-5 sm:pt-4">
      <div
        className={cn(
          "pointer-events-auto mx-auto flex items-center justify-between rounded-[22px] border px-3 transition-all duration-500 ease-out sm:px-4",
          scrolled
            ? "h-[58px] max-w-5xl border-black/10 bg-white/82 shadow-[0_18px_50px_-24px_rgba(13,18,28,.38)] backdrop-blur-2xl dark:border-white/10 dark:bg-[#0a0b0f]/82"
            : "h-[66px] max-w-6xl border-transparent bg-transparent",
        )}
      >
        <Link href="/" aria-label={SITE.name} className="rounded-xl px-1 py-1">
          <LogoLockup />
        </Link>

        <nav className="hidden items-center gap-1 text-[13px] font-semibold text-muted md:flex">
          <Link href="/#how" className="rounded-xl px-3 py-2 transition hover:bg-black/[.04] hover:text-fg-strong dark:hover:bg-white/[.05]">How it works</Link>
          <Link href="/#agents" className="rounded-xl px-3 py-2 transition hover:bg-black/[.04] hover:text-fg-strong dark:hover:bg-white/[.05]">Agents</Link>
          <Link href="/#pricing" className="rounded-xl px-3 py-2 transition hover:bg-black/[.04] hover:text-fg-strong dark:hover:bg-white/[.05]">Pricing</Link>
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          {signedIn ? (
            <Link href="/dashboard" className="kryx-primary inline-flex h-10 items-center gap-2 rounded-xl px-4 text-[13px] font-bold">
              Open Kryx <ArrowRight className="size-4" />
            </Link>
          ) : (
            <Link href="/login?mode=signup" className="kryx-primary inline-flex h-10 items-center gap-2 rounded-xl px-4 text-[13px] font-bold">
              Hire Kryx free <ArrowRight className="size-4" />
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
