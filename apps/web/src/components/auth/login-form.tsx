"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { createClient, SupabaseNotConfiguredError } from "@/lib/supabase/client";
import type { AuthProviders } from "@/lib/auth-providers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";

/**
 * Email and password, straight through.
 *
 * No magic links: a link means leaving the page, opening a mail client, and
 * hoping it lands in the inbox — three chances to lose someone who was one
 * form away from paying.
 *
 * Google is offered only when the Supabase project actually has the provider
 * enabled. It used to be rendered unconditionally as the first and largest
 * control on the page, which meant that on a project without Google configured
 * — the default — the most obvious way to sign up was a dead end that bounced
 * back with "Unsupported provider".
 */
export function LoginForm({
  next,
  mode: initialMode,
  providers,
}: {
  next: string;
  mode: "signup" | "signin";
  providers: AuthProviders;
}) {
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState<"google" | "email" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmNeeded, setConfirmNeeded] = useState(false);

  const redirectTo = `${
    typeof window === "undefined" ? "" : window.location.origin
  }/auth/callback?next=${encodeURIComponent(next)}`;

  async function withGoogle() {
    setPending("google");
    setError(null);

    let supabase: ReturnType<typeof createClient>;
    try {
      supabase = createClient();
    } catch (cause) {
      setError(configError(cause));
      setPending(null);
      return;
    }

    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo, queryParams: { prompt: "select_account" } },
    });
    if (authError) {
      setError(friendly(authError.message));
      setPending(null);
    }
  }

  async function withPassword(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;

    setPending("email");
    setError(null);

    let supabase: ReturnType<typeof createClient>;
    try {
      supabase = createClient();
    } catch (cause) {
      setError(configError(cause));
      setPending(null);
      return;
    }

    if (mode === "signup") {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: redirectTo },
      });

      if (signUpError) {
        setError(friendly(signUpError.message));
        setPending(null);
        return;
      }

      // With email confirmation switched on in Supabase, signUp returns a user
      // but no session. Saying so beats a silent no-op.
      if (!data.session) {
        setConfirmNeeded(true);
        setPending(null);
        return;
      }

      goTo(next);
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError(friendly(signInError.message));
      setPending(null);
      return;
    }

    goTo(next);
  }

  if (confirmNeeded) {
    return (
      <div className="panel-raised p-5">
        <p className="font-semibold text-fg-strong">Confirm your email.</p>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          We sent a confirmation to{" "}
          <span className="font-medium text-fg">{email}</span>. Click the link,
          then come back and sign in.
        </p>
        <button
          type="button"
          onClick={() => {
            setConfirmNeeded(false);
            setMode("signin");
          }}
          className="mt-4 text-sm font-semibold text-accent hover:underline"
        >
          Back to sign in
        </button>
      </div>
    );
  }

  if (!providers.signupsOpen && mode === "signup") {
    return (
      <div className="panel-raised p-5">
        <p className="font-semibold text-fg-strong">Signups are closed.</p>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          New accounts are switched off for this deployment right now. If you
          already have one, you can still sign in.
        </p>
        <button
          type="button"
          onClick={() => setMode("signin")}
          className="mt-4 text-sm font-semibold text-accent hover:underline"
        >
          Sign in instead
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {providers.google ? (
        <>
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

          <div className="flex items-center gap-3 text-xs font-medium uppercase tracking-wider text-faint">
            <span className="h-px flex-1 bg-line" />
            or
            <span className="h-px flex-1 bg-line" />
          </div>
        </>
      ) : null}

      <form onSubmit={withPassword} className="space-y-3">
        <Input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@company.com"
          aria-label="Email address"
          autoComplete="email"
        />
        <Input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder={
            mode === "signup" ? "Create a password (8+ characters)" : "Password"
          }
          aria-label="Password"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
        />
        <Button type="submit" disabled={pending !== null} size="md" className="w-full">
          {pending === "email" ? <Loader2 className="animate-spin" /> : null}
          {mode === "signup" ? "Create account" : "Sign in"}
        </Button>
      </form>

      {error ? (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}

      <p className="text-sm text-muted">
        {mode === "signup" ? "Already have an account?" : "New here?"}{" "}
        <button
          type="button"
          onClick={() => {
            setMode(mode === "signup" ? "signin" : "signup");
            setError(null);
          }}
          className="font-semibold text-accent hover:underline"
        >
          {mode === "signup" ? "Sign in" : "Create one"}
        </button>
      </p>
    </div>
  );
}

/**
 * A full page load, not a client-side push.
 *
 * The auth cookie is written moments before this runs. A `router.push` fetches
 * the next route as an RSC payload in the same tick and can be served a render
 * that still believes you are signed out — which lands on a redirect back to
 * login, or on nothing at all. A real navigation always carries the new cookie.
 */
function goTo(path: string) {
  window.location.assign(path);
}

function configError(cause: unknown): string {
  if (cause instanceof SupabaseNotConfiguredError) return cause.message;
  return cause instanceof Error ? cause.message : "Sign-in is unavailable.";
}

/** Supabase's auth errors are accurate and unhelpful. These are neither wrong nor cryptic. */
function friendly(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("invalid login credentials")) {
    return "That email and password do not match. Try again, or create an account.";
  }
  if (lower.includes("already registered") || lower.includes("already been registered")) {
    return "That email already has an account. Sign in instead.";
  }
  if (lower.includes("password should be at least")) {
    return "Passwords need at least 8 characters.";
  }
  if (lower.includes("email not confirmed")) {
    return "Confirm your email first — check your inbox for the link we sent.";
  }
  if (lower.includes("rate limit") || lower.includes("too many")) {
    return "Too many attempts. Wait a minute and try again.";
  }
  // The signup trigger runs inside the auth transaction, so a database that has
  // never had the schema applied surfaces here and nowhere more useful.
  if (lower.includes("database error") || lower.includes("unexpected_failure")) {
    return "The account could not be created — this deployment's database is not set up yet. See /setup.";
  }
  if (lower.includes("unsupported provider") || lower.includes("provider is not enabled")) {
    return "That sign-in method is not enabled. Use your email and a password instead.";
  }
  return message;
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
