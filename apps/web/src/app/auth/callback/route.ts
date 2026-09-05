import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enlistQuietly } from "@/lib/enlist";

export const dynamic = "force-dynamic";

/**
 * Where Google OAuth and the email-confirmation link land.
 *
 * Straight to the dashboard once the code is exchanged. No questionnaire in
 * between: the first screen after signing in should be the product, because
 * that is the only thing on the way to a decision. The four onboarding
 * questions are still asked — from inside the dashboard, where answering them
 * visibly reorders what is on screen.
 *
 * Nobody is ever redirected back to /login from here — that is what produced
 * the redirect loop that rendered as a blank dashboard.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = sanitizeNext(searchParams.get("next"));
  const authError = searchParams.get("error_description") ?? searchParams.get("error");

  if (authError) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(authError)}`,
    );
  }
  if (!code) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("That sign-in link is incomplete.")}`,
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`,
    );
  }

  // The army is created here, before the redirect, so the first dashboard the
  // founder ever sees already has twenty-five agents on it. Awaited rather
  // than fired off: a redirect that lands a quarter of a second before the
  // agents exist shows an empty dashboard, and an empty dashboard on the first
  // load is the only impression that matters.
  //
  // It never blocks the sign-in. `enlistQuietly` swallows its own failures,
  // and the dashboard layout enlists again on the next load if this one did
  // not take.
  if (data.user) await enlistQuietly(data.user.id);

  return NextResponse.redirect(`${origin}${next}`);
}

/** Only same-site paths, so `next` cannot become an open redirect. */
function sanitizeNext(value: string | null): string {
  if (!value) return "/dashboard";
  if (!value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}
