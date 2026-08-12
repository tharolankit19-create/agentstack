import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import { createAdminClient } from "./supabase/admin";
import { isEntitled, canOperate } from "./plans";
import type { Profile } from "./supabase/types";

/**
 * Who is signed in, what they have, and where they should be.
 *
 * Two rules shape this file, both learned from blank pages:
 *
 * 1. **A signed-in user is never sent back to /login.** Returning null when the
 *    profile row was missing sent an authenticated user to /login, which the
 *    proxy bounced back to /dashboard — a loop that renders as a white screen.
 *    A missing profile row is now repaired instead.
 *
 * 2. **A broken database is a redirect, not an exception.** Throwing from a
 *    layout during a client-side navigation does not reliably reach an error
 *    boundary. /setup renders without touching Supabase at all, so it works
 *    precisely when nothing else does.
 */

export interface Session {
  userId: string;
  email: string;
  profile: Profile;
}

export type SessionState =
  | { status: "anonymous" }
  | { status: "ready"; session: Session }
  /** Signed in, but the database cannot answer. Never a redirect. */
  | { status: "unavailable"; reason: string; setupRequired: boolean };

export async function loadSession(): Promise<SessionState> {
  // Building the client reads env vars and can throw. That throw used to reach
  // a layout and blank the page, so it is caught here and reported instead.
  let supabase: Awaited<ReturnType<typeof createClient>>;
  try {
    supabase = await createClient();
  } catch (cause) {
    return {
      status: "unavailable",
      setupRequired: true,
      reason: cause instanceof Error ? cause.message : "Supabase is not configured.",
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { status: "anonymous" };

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle<Profile>();

  if (error) {
    // PGRST205/42P01 mean the table is not there — the migrations never ran.
    // That is a setup problem with a specific fix, not a generic outage.
    const setupRequired = error.code === "PGRST205" || error.code === "42P01";
    return {
      status: "unavailable",
      setupRequired,
      reason: setupRequired
        ? "The database schema has not been created yet."
        : error.message || "The database rejected the request.",
    };
  }

  if (profile) {
    return {
      status: "ready",
      session: {
        userId: user.id,
        email: user.email ?? profile.email ?? "",
        profile,
      },
    };
  }

  // Authenticated with no profile row. Repair it rather than bounce them.
  const repaired = await ensureProfile(user.id, user.email ?? null);
  if (!repaired) {
    return {
      status: "unavailable",
      setupRequired: false,
      reason: "Your account exists but its profile could not be created.",
    };
  }

  return {
    status: "ready",
    session: {
      userId: user.id,
      email: user.email ?? repaired.email ?? "",
      profile: repaired,
    },
  };
}

/** Convenience for pages that only need the happy path. */
export async function getSession(): Promise<Session | null> {
  const state = await loadSession();
  return state.status === "ready" ? state.session : null;
}

/**
 * Creates the profile row a signup trigger should have made.
 *
 * Runs as the service role because a customer cannot insert their own profile
 * — that is what stops someone granting themselves a plan.
 */
async function ensureProfile(
  userId: string,
  email: string | null,
): Promise<Profile | null> {
  try {
    const admin = createAdminClient();

    const { data, error } = await admin
      .from("profiles")
      .upsert({ id: userId, email }, { onConflict: "id" })
      .select("*")
      .single<Profile>();

    if (error) {
      console.error("[auth] could not create the profile row:", error);
      return null;
    }
    return data;
  } catch (cause) {
    console.error("[auth] profile repair failed:", cause);
    return null;
  }
}

export function isOnboarded(profile: Profile): boolean {
  return Boolean(profile.onboarded_at);
}

/**
 * Signed in. That is the only gate on the dashboard.
 *
 * There used to be a second one — onboarding — and it was a mistake. Someone
 * who has just signed up has bought nothing and believes nothing, and the
 * worst possible thing to show them is a form. The dashboard is the pitch: the
 * whole library, their agents, the number they are still paying. Let them see
 * it, and ask the four questions from inside it, where the answers visibly
 * change something.
 *
 * A signed-in user is never redirected anywhere except /setup, so the loop
 * that caused the white screen cannot come back.
 */
export async function requireUser(returnTo = "/dashboard"): Promise<Session> {
  const state = await loadSession();

  if (state.status === "anonymous") {
    redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  }
  if (state.status === "unavailable") {
    redirect("/setup");
  }
  return state.session;
}

/**
 * The paywall, for API routes.
 *
 * Returns 402 rather than redirecting, because the dashboard turns that into
 * the upgrade modal. The wall is at the moment of action now — deploying,
 * building, running — not at the door.
 */
export async function requirePaidApiUser(): Promise<
  { ok: true; session: Session } | { ok: false; response: Response }
> {
  const state = await loadSession();

  if (state.status === "anonymous") {
    return {
      ok: false,
      response: Response.json({ error: "Sign in first." }, { status: 401 }),
    };
  }
  if (state.status === "unavailable") {
    return {
      ok: false,
      response: Response.json({ error: state.reason }, { status: 503 }),
    };
  }
  if (!isEntitled(state.session.profile)) {
    return {
      ok: false,
      response: Response.json(
        {
          error: "Pick a plan to turn your agents on.",
          code: "payment_required",
        },
        { status: 402 },
      ),
    };
  }
  return { ok: true, session: state.session };
}

/**
 * Signed in AND allowed to operate — the guard for every route that changes
 * something (deploy, configure, add a key, run a chat).
 *
 * During early access only the operator can act; everyone else is on the list
 * and gets a 403 with a message the dashboard shows as "you're on the list".
 * This is the server-side half of explore mode — the UI hides the buttons, and
 * this makes sure a hand-crafted request cannot get around them.
 */
export async function requireOperatorApiUser(): Promise<
  { ok: true; session: Session } | { ok: false; response: Response }
> {
  const base = await requirePaidApiUser();
  if (!base.ok) return base;

  if (!canOperate(base.session.profile)) {
    return {
      ok: false,
      response: Response.json(
        {
          error:
            "You're on the early-access list. Deploying and configuring open up soon — explore everything in the meantime.",
          code: "explore_only",
        },
        { status: 403 },
      ),
    };
  }
  return base;
}

/** Signed in, any plan. For routes that read but do not spend. */
export async function requireApiUser(): Promise<
  { ok: true; session: Session } | { ok: false; response: Response }
> {
  const state = await loadSession();

  if (state.status === "anonymous") {
    return {
      ok: false,
      response: Response.json({ error: "Sign in first." }, { status: 401 }),
    };
  }
  if (state.status === "unavailable") {
    return {
      ok: false,
      response: Response.json({ error: state.reason }, { status: 503 }),
    };
  }
  return { ok: true, session: state.session };
}

/**
 * Kept for the API routes, which report the reason in JSON rather than moving
 * the browser. Pages redirect to /setup instead of throwing this.
 */
export class SetupError extends Error {
  readonly setupRequired: boolean;

  constructor(message: string, setupRequired: boolean) {
    super(message);
    this.name = "SetupError";
    this.setupRequired = setupRequired;
  }
}
