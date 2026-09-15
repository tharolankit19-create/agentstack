import Link from "next/link";
import type { Metadata } from "next";
import { Check } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";
import { authProviders } from "@/lib/auth-providers";
import { SITE } from "@/lib/site";
import { LogoLockup } from "@/components/ui/logo";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string; mode?: string }> }) {
  const params = await searchParams;
  const mode = params.mode === "signup" ? "signup" : "signin";
  const providers = await authProviders();

  return (
    <main className="kryx-auth-bg relative grid min-h-dvh place-items-center overflow-hidden px-5 py-10 text-fg">
      <div className="relative w-full max-w-md">
        <Link href="/" className="mx-auto mb-7 block w-fit" aria-label={SITE.name}><LogoLockup /></Link>
        <div className="kryx-auth-card p-6 sm:p-8">
          <div className="text-center">
            <p className="microlabel">{mode === "signup" ? "100 credits included" : "Welcome back"}</p>
            <h1 className="mt-3 text-3xl font-extrabold tracking-[-.035em] text-fg-strong">{mode === "signup" ? "Give Kryx the first mission" : "Open your workspace"}</h1>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted">{mode === "signup" ? "Create your account, give Kryx your site, and start with 100 credits. No card and no monthly plan." : "Your team, memory, approvals and work are waiting where you left them."}</p>
          </div>

          {mode === "signup" ? (
            <div className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-2 border-y border-line py-3">
              {["100 credits", "No card", "$0/month"].map((item) => <span key={item} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted"><Check className="size-3.5 text-money" />{item}</span>)}
            </div>
          ) : null}

          {params.error ? <p role="alert" className="mt-5 rounded-xl border border-[var(--danger-line)] bg-[var(--danger-wash)] px-4 py-3 text-sm text-danger">{decodeURIComponent(params.error)}</p> : null}

          <div className="mt-6"><LoginForm next={params.next ?? "/dashboard"} mode={mode} providers={providers} /></div>

          <p className="mt-6 text-center text-xs leading-relaxed text-faint">By continuing you agree to the <Link href="/terms" className="underline hover:text-muted">terms</Link> and <Link href="/privacy" className="underline hover:text-muted">privacy policy</Link>.</p>
        </div>
      </div>
    </main>
  );
}
