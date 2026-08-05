import Link from "next/link";
import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";
import { authProviders } from "@/lib/auth-providers";
import { SITE } from "@/lib/site";
import { LogoLockup } from "@/components/ui/logo";

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
  const providers = await authProviders();

  return (
    <main className="grid-field bg-bg text-fg grid min-h-dvh place-items-center px-5 py-12">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-10 inline-block" aria-label={SITE.name}>
          <LogoLockup />
        </Link>

        <h1 className="text-3xl font-extrabold text-fg-strong">
          {mode === "signup" ? "Create your account" : "Welcome back"}
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">
          {mode === "signup"
            ? "Takes 20 seconds. You pick your agents on the next screen."
            : "Sign in and your agents are where you left them."}
        </p>

        {params.error ? (
          <p
            role="alert"
            className="mt-6 rounded-lg border border-[var(--danger-line)] bg-[var(--danger-wash)] px-4 py-3 text-sm text-danger"
          >
            {decodeURIComponent(params.error)}
          </p>
        ) : null}

        <div className="mt-8">
          <LoginForm
            next={params.next ?? "/dashboard"}
            mode={mode}
            providers={providers}
          />
        </div>

        <p className="mt-6 text-xs text-faint">
          Sign-in not working?{" "}
          <Link href="/setup" className="underline hover:text-muted">
            Check the setup
          </Link>
          .
        </p>

        <p className="mt-4 text-xs leading-relaxed text-faint">
          By continuing you agree to the{" "}
          <Link href="/terms" className="underline hover:text-muted">
            terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline hover:text-muted">
            privacy policy
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
