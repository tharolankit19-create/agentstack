import "server-only";

/**
 * Which sign-in methods this Supabase project actually has switched on.
 *
 * The login page used to offer "Continue with Google" unconditionally. If the
 * provider is not enabled in the Supabase dashboard — which is the default for
 * a new project — that button goes to a Supabase error page and comes back
 * with `?error=Unsupported+provider`. It was the most prominent control on the
 * page and it was a dead end, which is a very expensive thing for a signup
 * screen to be.
 *
 * `/auth/v1/settings` is a public, unauthenticated endpoint that reports
 * exactly this, so the form can be built from the truth instead of from a
 * guess. If the call fails we fall back to email-and-password, which is the
 * one method that is always available.
 */

export interface AuthProviders {
  google: boolean;
  /** False when the project has signups turned off entirely. */
  signupsOpen: boolean;
  /** True when Supabase will email a confirmation link before first sign-in. */
  confirmationRequired: boolean;
}

const FALLBACK: AuthProviders = {
  google: false,
  signupsOpen: true,
  confirmationRequired: false,
};

export async function authProviders(): Promise<AuthProviders> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return FALLBACK;

  try {
    const res = await fetch(`${url.replace(/\/+$/, "")}/auth/v1/settings`, {
      headers: { apikey: anonKey },
      // Providers change when someone edits the dashboard, not per request.
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return FALLBACK;

    const settings = (await res.json()) as {
      external?: Record<string, boolean>;
      disable_signup?: boolean;
      mailer_autoconfirm?: boolean;
    };

    return {
      google: settings.external?.google === true,
      signupsOpen: settings.disable_signup !== true,
      confirmationRequired: settings.mailer_autoconfirm === false,
    };
  } catch {
    // A slow or unreachable auth server must not take the login page with it.
    return FALLBACK;
  }
}
