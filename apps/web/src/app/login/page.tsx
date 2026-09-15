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
      <div className="absolute left-[8%] top-[10%] size-40 rounded-full bg-[#4f6bff]/15 blur-3xl" aria-hidden />
      <div className="absolute right-[8%] top-[14%] size-40 rounded-full bg-[#35d6a6]/15 blur-3xl" aria-hidden />
      <div className="relative w-full max-w-md">
        <Link href="/" className="mx-auto mb-7 block w-fit" aria-label={SITE.name}><LogoLockup /></Link>
        <div className="kryx-auth-card rounded-[30px] p-6 sm:p-8">
          <div className="text-center">
            <p className="text-xs font-bold uppercase tracking-[.16em] text-accent">{mode === "signup" ? "$1 of work included" : "Welcome back"}</p>
            <h1 className="mt-3 text-3xl font-extrabold tracking-[-.035em] text-fg-strong">{mode === "signup" ? "Hire your AI Head of Marketing" : "Open your command center"}</h1>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted">{mode === "signup" ? "Create your account, give Kryx your site, and start with 100 credits. No card and no monthly plan." : "Your team, memory, approvals and work are waiting where you left them."}</p>
          </div>

          {mode === "signup" ? (
            <div className="mt-5 grid grid-cols-3 gap-2">
              {["100 free credits", "No card", "$0/month"].map((item) => <div key={item} className="rounded-xl border border-line bg-surface-2/80 px-2 py-2.5 text-center text-[11px] font-semibold text-muted"><Check className="mx-auto mb-1 size-3.5 text-live" />{item}</div>)}
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
