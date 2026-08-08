import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`,
    );
  }

  return NextResponse.redirect(`${origin}${next}`);
}

/** Only same-site paths, so `next` cannot become an open redirect. */
function sanitizeNext(value: string | null): string {
  if (!value) return "/dashboard";
  if (!value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}
