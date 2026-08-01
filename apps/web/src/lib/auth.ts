import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import { hasPaid } from "./plans";
import type { Profile } from "./supabase/types";

/**
 * The paywall, in one place.
 *
 * `middleware.ts` does the cheap cookie check so unpaid traffic never reaches
 * a page. These helpers re-check against the database, because middleware runs
 * on a token and a token is not an entitlement.
 */

export interface Session {
  userId: string;
  email: string;
  profile: Profile;
}

export async function getSession(): Promise<Session | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle<Profile>();

  if (!profile) return null;
  return { userId: user.id, email: user.email ?? profile.email ?? "", profile };
}

/** Signed in, or bounced to login. */
export async function requireUser(returnTo = "/dashboard"): Promise<Session> {
  const session = await getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  return session;
}

/** Signed in AND paid, or bounced to pricing. */
export async function requirePaidUser(returnTo = "/dashboard"): Promise<Session> {
  const session = await requireUser(returnTo);
  if (!hasPaid(session.profile.plan)) redirect("/pricing?from=dashboard");
  return session;
}

/** API-route flavour: returns a Response instead of redirecting. */
export async function requirePaidApiUser(): Promise<
  { ok: true; session: Session } | { ok: false; response: Response }
> {
  const session = await getSession();

  if (!session) {
    return {
      ok: false,
      response: Response.json({ error: "Sign in first." }, { status: 401 }),
    };
  }
  if (!hasPaid(session.profile.plan)) {
    return {
      ok: false,
      response: Response.json(
        { error: "This needs a plan. Buy AgentStack to continue.", code: "payment_required" },
        { status: 402 },
      ),
    };
  }
  return { ok: true, session };
}
