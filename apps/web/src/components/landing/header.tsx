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
          "pointer-events-auto mx-auto flex items-center justify-between rounded-[24px] border border-white/[.14] bg-[#090b10]/[.94] px-3 text-white shadow-[0_24px_70px_-30px_rgba(0,0,0,.82)] backdrop-blur-2xl transition-[height,max-width,transform,background-color,box-shadow] duration-500 ease-out sm:px-4",
          scrolled
            ? "h-[54px] max-w-5xl translate-y-1 bg-[#090b10]/[.97] shadow-[0_18px_52px_-28px_rgba(0,0,0,.88)]"
            : "h-[64px] max-w-6xl",
        )}
      >
        <Link href="/" aria-label={SITE.name} className="rounded-xl px-1 py-1 text-white [&>span>span:last-child]:!text-white">
          <LogoLockup />
        </Link>

        <nav className="hidden items-center gap-1 text-[13px] font-semibold text-white md:flex">
          <Link href="/#how" className="rounded-xl px-3 py-2 !text-white/80 transition hover:bg-white/[.09] hover:!text-white">How it works</Link>
          <Link href="/#agents" className="rounded-xl px-3 py-2 !text-white/80 transition hover:bg-white/[.09] hover:!text-white">Agents</Link>
          <Link href="/#pricing" className="rounded-xl px-3 py-2 !text-white/80 transition hover:bg-white/[.09] hover:!text-white">Pricing</Link>
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle className="border-white/15 bg-white/[.06] !text-white hover:bg-white/[.12]" />
          <Link
            href={signedIn ? "/dashboard" : "/login?mode=signup"}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-[13px] font-bold !text-[#090b10] shadow-sm transition-all hover:-translate-y-0.5 hover:bg-[#f4f5f7] active:translate-y-0"
          >
            {signedIn ? "Open Kryx" : "Start free"} <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </header>
  );
}
