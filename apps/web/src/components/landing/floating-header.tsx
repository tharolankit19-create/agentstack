"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { LogoLockup } from "@/components/ui/logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { SITE } from "@/lib/site";

export function FloatingHeader({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-5 sm:pt-4">
      <div className="pointer-events-auto mx-auto flex h-[60px] max-w-6xl items-center justify-between rounded-[22px] border border-white/10 bg-[#0b0d12] px-3.5 text-white shadow-[0_20px_60px_-28px_rgba(10,14,24,.72)] sm:px-4">
        <Link href="/" aria-label={SITE.name} className="shrink-0"><LogoLockup inverse /></Link>
        <nav className="hidden items-center gap-1 text-[13px] font-semibold text-white/85 md:flex">
          <Link className="rounded-xl px-3 py-2 transition hover:bg-white/10 hover:text-white" href="#demo">Demo</Link>
          <Link className="rounded-xl px-3 py-2 transition hover:bg-white/10 hover:text-white" href="#agents">Agents</Link>
          <Link className="rounded-xl px-3 py-2 transition hover:bg-white/10 hover:text-white" href="/pricing">Pricing</Link>
          <Link className="rounded-xl px-3 py-2 transition hover:bg-white/10 hover:text-white" href="/security">Security</Link>
        </nav>
        <div className="flex items-center gap-1.5">
          <ThemeToggle className="hidden border-white/15 bg-white/[.06] text-white hover:bg-white/10 sm:inline-flex" />
          {signedIn ? (
            <Link href="/dashboard" className="inline-flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-[#0b0d12] transition hover:-translate-y-0.5 active:translate-y-0">Open Kryx <ArrowRight className="size-4" /></Link>
          ) : (
            <>
              <Link href="/login" className="hidden rounded-xl px-3 py-2 text-sm font-semibold text-white/75 transition hover:bg-white/[.08] hover:text-white sm:inline-flex">Sign in</Link>
              <Link href="/login?mode=signup" className="inline-flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-[#0b0d12] transition hover:-translate-y-0.5 active:translate-y-0">Start free <ArrowRight className="size-4" /></Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
