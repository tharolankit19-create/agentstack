"use client";

import { useState } from "react";
import { Loader2, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";

/**
 * Google first, because that is what founders click. Email is the fallback for
 * people who bought with an address that is not a Google account.
 */
export function LoginForm({ next }: { next: string }) {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState<"google" | "email" | null>(null);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redirectTo = `${typeof window === "undefined" ? "" : window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  async function withGoogle() {
    setPending("google");
    setError(null);
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });
    if (authError) {
      setError(authError.message);
      setPending(null);
    }
  }

  async function withEmail(event: React.FormEvent) {
    event.preventDefault();
    if (!email.trim()) return;

    setPending("email");
    setError(null);
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo },
    });

    if (authError) setError(authError.message);
    else setSent(true);
    setPending(null);
  }

  if (sent) {
    return (
      <div className="rounded-xl border border-[var(--color-surface-line)] bg-[var(--color-surface-raised)] p-5">
        <Mail className="size-5 text-[var(--color-accent)]" />
        <p className="mt-3 font-semibold text-white">Check your email.</p>
        <p className="mt-1 text-sm leading-relaxed text-zinc-400">
          We sent a sign-in link to{" "}
          <span className="font-medium text-zinc-200">{email}</span>. It works
          once and expires in an hour.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Button
        onClick={withGoogle}
        disabled={pending !== null}
        variant="outline"
        size="md"
        className="w-full"
      >
        {pending === "google" ? (
          <Loader2 className="animate-spin" />
        ) : (
          <GoogleMark />
        )}
        Continue with Google
      </Button>

      <div className="flex items-center gap-3 text-xs font-medium uppercase tracking-wider text-zinc-600">
        <span className="h-px flex-1 bg-[var(--color-surface-line)]" />
        or
        <span className="h-px flex-1 bg-[var(--color-surface-line)]" />
      </div>

      <form onSubmit={withEmail} className="space-y-3">
        <Input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@company.com"
          aria-label="Email address"
          autoComplete="email"
        />
        <Button
          type="submit"
          disabled={pending !== null}
          variant="ink"
          size="md"
          className="w-full border border-[var(--color-surface-line)]"
        >
          {pending === "email" ? <Loader2 className="animate-spin" /> : null}
          Email me a sign-in link
        </Button>
      </form>

      {error ? (
        <p role="alert" className="text-sm font-medium text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-4">
      <path
        fill="#4285F4"
        d="M23.06 12.25c0-.85-.08-1.67-.22-2.45H12v4.63h6.2a5.3 5.3 0 0 1-2.3 3.48v2.9h3.72c2.18-2 3.44-4.96 3.44-8.56z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.1 0 5.7-1.03 7.6-2.79l-3.72-2.89c-1.03.69-2.35 1.1-3.88 1.1-2.98 0-5.5-2.01-6.4-4.72H1.75v2.98A11.5 11.5 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.6 14.7a6.9 6.9 0 0 1 0-4.4V7.32H1.75a11.5 11.5 0 0 0 0 10.36l3.85-2.98z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.68 0 3.19.58 4.38 1.72l3.28-3.28C17.7 1.28 15.1.25 12 .25A11.5 11.5 0 0 0 1.75 7.32L5.6 10.3C6.5 7.6 9.02 4.75 12 4.75z"
      />
    </svg>
  );
}
