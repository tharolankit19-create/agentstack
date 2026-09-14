import Link from "next/link";
import { SITE } from "@/lib/site";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { LogoLockup } from "@/components/ui/logo";

export function Header({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="sticky top-0 z-50 border-b border-black/[.06] bg-white/70 backdrop-blur-2xl dark:border-white/[.07] dark:bg-[#08090c]/70">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Link href="/" aria-label={SITE.name}><LogoLockup /></Link>
        <nav className="flex items-center gap-1.5 text-sm font-semibold text-muted">
          <Link href="/demo" className="hidden rounded-xl px-3 py-2 transition hover:text-fg-strong sm:block">Demo</Link>
          <Link href="/#pricing" className="rounded-xl px-3 py-2 transition hover:text-fg-strong">Pricing</Link>
          <ThemeToggle className="ml-1" />
          {signedIn ? (
            <Link href="/dashboard" className="kryx-primary ml-1 inline-flex h-10 items-center rounded-xl px-4 text-sm font-bold">Open Kryx</Link>
          ) : (
            <>
              <Link href="/login" className="hidden rounded-xl px-3 py-2 transition hover:text-fg-strong sm:block">Sign in</Link>
              <Link href="/login?mode=signup" className="kryx-primary ml-1 inline-flex h-10 items-center rounded-xl px-4 text-sm font-bold">Hire Kryx free</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
