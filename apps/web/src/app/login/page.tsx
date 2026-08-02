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
  searchParams: Promise<{ next?: string; error?: string; mode?: string }>;
}) {
  const params = await searchParams;
  const mode = params.mode === "signup" ? "signup" : "signin";

  return (
    <main className="surface-dark grid min-h-dvh place-items-center px-5 py-12">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-10 flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg bg-[var(--color-accent)] text-sm font-black text-white">
            A
          </span>
          <span className="text-[17px] font-bold text-white">{SITE.name}</span>
        </Link>

        <h1 className="text-3xl font-extrabold text-white">
          {mode === "signup" ? "Create your account" : "Welcome back"}
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-zinc-400">
          {mode === "signup"
            ? "Takes 20 seconds. You pick your agents on the next screen."
            : "Sign in and your agents are where you left them."}
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
          <LoginForm next={params.next ?? "/dashboard"} mode={mode} />
        </div>

        <p className="mt-6 text-xs text-zinc-600">
          Sign-in not working?{" "}
          <Link href="/setup" className="underline hover:text-zinc-400">
            Check the setup
          </Link>
          .
        </p>

        <p className="mt-4 text-xs leading-relaxed text-zinc-600">
          By continuing you agree to the{" "}
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
