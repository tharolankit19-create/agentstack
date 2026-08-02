import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Route protection. (Next 16 renamed this convention from `middleware` to
 * `proxy`; same runtime, same matcher.)
 *
 * Unauthenticated → /login. Authenticated but unpaid → /pricing. The dashboard
 * is never rendered for someone who has not paid: no preview, no read-only
 * mode, no "upgrade to unlock" empty state.
 *
 * This is the fast path only. Pages and API routes re-check the plan against
 * the database in `lib/auth.ts` — a cookie says who you are, not what you own.
 */

const PUBLIC_PATHS = [
  "/",
  "/login",
  "/pricing",
  "/terms",
  "/privacy",
  "/checkout/success",
];

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Webhooks and auth callbacks authenticate themselves.
  if (
    pathname.startsWith("/api/webhooks/") ||
    pathname.startsWith("/api/agents/callback") ||
    pathname.startsWith("/auth/")
  ) {
    return NextResponse.next();
  }

  const { response, user } = await updateSession(request);

  const isPublic =
    PUBLIC_PATHS.includes(pathname) ||
    pathname.startsWith("/api/demo") ||
    pathname.startsWith("/api/checkout") ||
    // Config check. Reports booleans only, so it is safe unauthenticated —
    // and it has to be, or you cannot diagnose a broken deploy.
    pathname === "/api/health";

  if (isPublic) {
    // A signed-in customer landing on /login goes straight through.
    if (user && pathname === "/login") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return response;
  }

  if (!user) {
    // An API caller wants a status code it can branch on, not a login page.
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except static assets and image files — those never need a
     * session refresh and paying for one on each would be wasteful.
     */
    "/((?!_next/static|_next/image|favicon.ico|opengraph-image|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
