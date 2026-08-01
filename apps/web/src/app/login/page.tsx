import Link from "next/link";
import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="surface-dark grid min-h-dvh place-items-center px-5 py-12">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-10 flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg bg-[var(--color-accent)] text-sm font-black text-white">
            A
          </span>
          <span className="text-[17px] font-bold text-white">{SITE.name}</span>
        </Link>

        <h1 className="text-3xl font-extrabold text-white">Sign in</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-zinc-400">
          Use the account you paid with. New here?{" "}
          <Link
            href="/#pricing"
            className="font-semibold text-[#c4b5fd] hover:underline"
          >
            Start at $29
          </Link>
          .
        </p>

        {params.error ? (
          <p
            role="alert"
            className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
          >
            {decodeURIComponent(params.error)}
          </p>
        ) : null}

        <div className="mt-8">
          <LoginForm next={params.next ?? "/dashboard"} />
        </div>

        <p className="mt-8 text-xs leading-relaxed text-zinc-600">
          By signing in you agree to the{" "}
          <Link href="/terms" className="underline hover:text-zinc-400">
            terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline hover:text-zinc-400">
            privacy policy
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
