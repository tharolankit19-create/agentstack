import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasPaid } from "@/lib/plans";
import type { Profile } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

/**
 * Where Google OAuth and the email-confirmation link land.
 *
 * After the code is exchanged, the customer goes to the dashboard if they are
 * subscribed and to pricing if they are not. Signing in is not access.
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

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("plan")
      .eq("id", user.id)
      .maybeSingle<Pick<Profile, "plan">>();

    if (!hasPaid(profile?.plan)) {
      return NextResponse.redirect(`${origin}/pricing?from=login`);
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
