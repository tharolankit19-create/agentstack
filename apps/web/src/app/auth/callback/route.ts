import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

/**
 * Where Google OAuth and the email-confirmation link land.
 *
 * After the code is exchanged, a customer who has not finished onboarding goes
 * there first. Nobody is ever redirected back to /login from here — that is
 * what produced the redirect loop that rendered as a blank dashboard.
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Onboarding comes before the dashboard; payment comes at the moment they
  // try to turn an agent on, not here.
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarded_at")
      .eq("id", user.id)
      .maybeSingle<Pick<Profile, "onboarded_at">>();

    if (!profile?.onboarded_at) {
      return NextResponse.redirect(
        `${origin}/onboarding?next=${encodeURIComponent(next)}`,
      );
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}

/** Only same-site paths, so `next` cannot become an open redirect. */
function sanitizeNext(value: string | null): string {
  if (!value) return "/dashboard";
  if (!value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}
