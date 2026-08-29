import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Route protection. (Next 16 renamed this convention from `middleware` to
 * `proxy`; same runtime, same matcher.)
 *
 * Unauthenticated → /login. Signed in but not onboarded → /onboarding, decided
 * by the page itself. Payment is not checked here at all any more: the whole
 * dashboard is browsable, and the wall arrives when someone tries to switch an
 * agent on.
 *
 * The rule that matters most in this file: **it must never throw.** Code here
 * runs before React, so an exception is a 500 with an empty body on every
 * route — a white screen that no error boundary can catch. Everything below is
 * written to degrade rather than fail.
 */

const PUBLIC_PATHS = [
  "/",
  "/login",
  "/pricing",
  "/terms",
  "/privacy",
  "/setup",
  "/checkout/success",
];

function isPublic(pathname: string): boolean {
  return (
    PUBLIC_PATHS.includes(pathname) ||
    // The public directory, and every tool page under it.
    pathname === "/replace" ||
    pathname.startsWith("/replace/") ||
    pathname.startsWith("/api/checkout") ||
    // Config check. Reports booleans only, so it is safe unauthenticated — and
    // it has to be, or you cannot diagnose a broken deploy.
    pathname === "/api/health"
  );
}

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Webhooks and auth callbacks authenticate themselves, so they must skip the
  // session gate entirely. This list is load-bearing: a caller that reaches
  // one of these paths has no Supabase cookie by definition — it is Telegram,
  // or Dodo, or a deployed agent — and without the bypass the session check
  // below returns 401 and the route never runs.
  //
  // The Telegram webhook is the one that was missing, and its absence was the
  // whole reason the bot never replied: every `/start` was answered with 401
  // by this middleware before the handler could see it. Note the path is
  // `/api/telegram/webhook`, which does NOT match `/api/webhooks/`. The other
  // two Telegram routes (`/link`, `/setup`) are deliberately not here — they
  // are called by a signed-in browser and enforce their own auth.
  if (
    pathname === "/api/telegram/webhook" ||
    pathname.startsWith("/api/webhooks/") ||
    pathname.startsWith("/api/agents/callback") ||
    pathname.startsWith("/api/agents/memory") ||
    pathname.startsWith("/api/cron/") ||
    pathname.startsWith("/auth/")
  ) {
    return NextResponse.next();
  }

  const { response, user, configured } = await updateSession(request);

  // Supabase is not configured. Nothing that needs a session can work, so say
  // so on one page instead of failing differently on every page.
  if (!configured) {
    if (pathname === "/setup" || pathname === "/api/health") return response;
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "The app is not configured yet. See /setup." },
        { status: 503 },
      );
    }
    // The landing page and the legal pages do not need a session, so they
    // stay up — a misconfigured deploy should still be able to sell.
    if (isPublic(pathname)) return response;
    return NextResponse.redirect(new URL("/setup", request.url));
  }

  if (isPublic(pathname)) {
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
     * Everything except static assets and the machine-readable files — those
     * never need a session refresh and paying for one on each would be
     * wasteful. robots.txt, sitemap.xml and llms.txt belong in that list for a
     * second reason: they are read by crawlers that carry no cookie, so
     * anything that sends them to /login makes the site unreadable to exactly
     * the readers those files exist for.
     */
    "/((?!_next/static|_next/image|favicon.ico|opengraph-image|robots.txt|sitemap.xml|llms.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
