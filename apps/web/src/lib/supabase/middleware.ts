import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the auth cookie on every request and reports who is signed in.
 *
 * This runs before React, which means **anything thrown here is a 500 with an
 * empty body on every route** — a white screen that no error boundary can
 * catch, including on the landing page and the login page. That is exactly
 * what happened when `NEXT_PUBLIC_SUPABASE_ANON_KEY` was missing: the Supabase
 * client constructor threw and took the whole site down.
 *
 * So this function does not throw. Ever. A missing or broken configuration is
 * reported as `configured: false` and the proxy decides what to do about it.
 */

export interface SessionResult {
  response: NextResponse;
  user: { id: string } | null;
  /** False when the Supabase environment is missing or the client failed. */
  configured: boolean;
}

export async function updateSession(request: NextRequest): Promise<SessionResult> {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    // Checked rather than asserted with `!`, because the assertion is what
    // turned a missing variable into a site-wide outage.
    return { response, user: null, configured: false };
  }

  try {
    const supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    });

    // Cryptographically verify claims; asymmetric projects reuse cached JWKS.
    // API handlers still check the live user and entitlement before mutations.
    const { data, error } = await supabase.auth.getClaims();
    const id = !error && typeof data?.claims?.sub === "string" ? data.claims.sub : null;
    return { response, user: id ? { id } : null, configured: true };
  } catch (cause) {
    // A network blip talking to the auth server must not blank the site. Treat
    // the visitor as signed out for this request and carry on.
    console.error("[proxy] session refresh failed:", cause);
    return { response, user: null, configured: false };
  }
}
