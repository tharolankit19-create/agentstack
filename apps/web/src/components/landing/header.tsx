import Link from "next/link";
import { SITE } from "@/lib/site";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { LogoLockup } from "@/components/ui/logo";

/**
 * Sticky, translucent, and hairline-thin.
 *
 * Pricing sits in the nav because it is the second thing people click and the
 * first thing they use to understand the product. The signup button is the
 * only filled control anywhere in the header — the accent means "this is the
 * action", and a second one would make it mean nothing.
 */
export function Header({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-bg/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Link href="/" aria-label={SITE.name}>
          <LogoLockup />
        </Link>

        <nav className="flex items-center gap-1 text-sm font-medium text-muted sm:gap-2">
          {/* First, and always visible. Everything else in this nav is a claim
              about the product; this is the product. */}
          <Link
            href="/demo"
            className="rounded-md px-3 py-2 font-semibold text-fg transition-colors hover:text-fg-strong"
          >
            See it working
          </Link>
          <Link
            href="/#agents"
            className="hidden rounded-md px-3 py-2 transition-colors hover:text-fg-strong sm:block"
          >
            The army
          </Link>
          <Link
            href="/#pricing"
            className="rounded-md px-3 py-2 transition-colors hover:text-fg-strong"
          >
            Pricing
          </Link>
          <Link
            href="/#faq"
            className="hidden rounded-md px-3 py-2 transition-colors hover:text-fg-strong sm:block"
          >
            FAQ
          </Link>

          <ThemeToggle className="ml-1" />

          {signedIn ? (
            <Link
              href="/dashboard"
              className="ml-1 rounded-lg border border-line bg-surface-2 px-4 py-2 font-semibold text-fg transition-transform hover:scale-[1.02]"
            >
              Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden rounded-md px-3 py-2 transition-colors hover:text-fg-strong sm:block"
              >
                Sign in
              </Link>
              <Link
                href="/login?mode=signup"
                className="ml-1 rounded-lg bg-accent px-4 py-2 font-semibold text-accent-fg transition-transform hover:scale-[1.02]"
              >
                Start free
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
