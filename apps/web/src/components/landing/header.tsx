import Link from "next/link";
import { SITE } from "@/lib/site";

/**
 * Dark header, white body. Pricing sits in the header because it is the second
 * thing people click and the first thing they use to understand the product.
 */
export function Header({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[var(--color-surface)]/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg bg-[var(--color-accent)] text-sm font-black text-white">
            A
          </span>
          <span className="text-[17px] font-bold tracking-tight text-white">
            {SITE.name}
          </span>
        </Link>

        <nav className="flex items-center gap-1 text-sm font-medium text-zinc-400 sm:gap-2">
          <Link
            href="/#agents"
            className="hidden rounded-md px-3 py-2 transition-colors hover:text-white sm:block"
          >
            Agents
          </Link>
          <Link
            href="/#pricing"
            className="rounded-md px-3 py-2 transition-colors hover:text-white"
          >
            Pricing
          </Link>
          <Link
            href="/#faq"
            className="hidden rounded-md px-3 py-2 transition-colors hover:text-white sm:block"
          >
            FAQ
          </Link>

          {signedIn ? (
            <Link
              href="/dashboard"
              className="ml-1 rounded-lg bg-white px-4 py-2 font-semibold text-[var(--color-ink)] transition-transform hover:scale-[1.02]"
            >
              Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-md px-3 py-2 transition-colors hover:text-white"
              >
                Sign in
              </Link>
              <Link
                href="/login?mode=signup"
                className="ml-1 rounded-lg bg-[var(--color-accent)] px-4 py-2 font-semibold text-white transition-transform hover:scale-[1.02]"
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
