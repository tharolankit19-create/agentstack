import { createAdminClient } from "./supabase/admin";
import { sealSecrets, openSecrets } from "./crypto";
import { VercelClient } from "./vercel";
import { hostsOwnAgents, isAdmin } from "./plans";
import type { Profile } from "./supabase/types";

/**
 * The customer's own Vercel account.
 *
 * On Starter and Unlimited the agents run on *their* infrastructure — that is
 * literally what those tiers are — so the deploy has to authenticate as them.
 * This is where that token lives and how it is used.
 *
 * Three rules, all the same rule as `agent_secrets`:
 *
 *   1. It is encrypted with the same AES-256-GCM envelope before it reaches
 *      the database, so a dump of `profiles` is not a set of live Vercel
 *      tokens.
 *   2. It is read only through the service role, at the moment of a deploy,
 *      and never selected into a page or an API response.
 *   3. It is validated at connect time. A token that cannot call
 *      `/v2/user` is rejected there and then, because the alternative is a
 *      customer finding out their token was wrong three screens later when a
 *      deploy fails for a reason we could have told them immediately.
 */

/** What the UI is allowed to know about a connected account. */
export interface HostingStatus {
  connected: boolean;
  /** Which Vercel account, so they can tell if it is the right one. */
  accountLabel: string | null;
  teamId: string | null;
  connectedAt: string | null;
  /** True when this plan expects the customer to bring their own. */
  selfHosted: boolean;
  /** True when a deploy would fail right now for want of a token. */
  needsToken: boolean;
}

export function hostingStatus(profile: Profile): HostingStatus {
  const selfHosted = hostsOwnAgents(profile);
  const connected = Boolean(profile.vercel_connected_at);

  return {
    connected,
    accountLabel: profile.vercel_account_label,
    teamId: profile.vercel_team_id,
    connectedAt: profile.vercel_connected_at,
    selfHosted,
    // Admins fall back to the platform token, so they are never blocked.
    needsToken: selfHosted && !connected && !isAdmin(profile),
  };
}

/** Confirms a token works and returns who it belongs to. */
export async function describeVercelToken(
  token: string,
  teamId?: string,
): Promise<{ label: string }> {
  const response = await fetch("https://api.vercel.com/v2/user", {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (response.status === 401 || response.status === 403) {
    throw new Error(
      "Vercel rejected that token. Check you copied all of it and that it has not expired.",
    );
  }
  if (!response.ok) {
    throw new Error(`Vercel returned ${response.status}. Try again in a moment.`);
  }

  const payload = (await response.json()) as {
    user?: { username?: string; email?: string; name?: string };
  };
  const user = payload.user ?? {};
  const label = user.username || user.email || user.name || "your Vercel account";

  // A team id that the token cannot see is the single most common way for this
  // to be wrong, and it fails silently at deploy time rather than here.
  if (teamId) {
    const teamResponse = await fetch(
      `https://api.vercel.com/v2/teams/${encodeURIComponent(teamId)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!teamResponse.ok) {
      throw new Error(
        "That token works, but it cannot see that team id. Check the team id, or leave it blank to deploy to your personal account.",
      );
    }
  }

  return { label: teamId ? `${label} · team ${teamId}` : label };
}

/** Stores a validated token. Service role only — the column is RLS-pinned. */
export async function connectVercel(
  userId: string,
  token: string,
  teamId: string | null,
): Promise<HostingStatus> {
  const { label } = await describeVercelToken(token, teamId ?? undefined);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .update({
      // Same envelope as agent secrets, so there is one format to reason about.
      vercel_token_enc: sealSecrets({ VERCEL_API_TOKEN: token }),
      vercel_account_label: label,
      vercel_team_id: teamId,
      vercel_connected_at: new Date().toISOString(),
    })
    .eq("id", userId)
    .select("*")
    .single<Profile>();

  if (error || !data) {
    throw new Error("Could not save that token. Try again.");
  }
  return hostingStatus(data);
}

export async function disconnectVercel(userId: string): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from("profiles")
    .update({
      vercel_token_enc: null,
      vercel_account_label: null,
      vercel_team_id: null,
      vercel_connected_at: null,
    })
    .eq("id", userId);
}

/**
 * The Vercel client a deploy for this user should use.
 *
 * Managed plans get the platform token, which is the thing they are paying
 * for. Self-hosted plans get their own, and are told plainly when they have
 * not connected one — rather than silently deploying onto our account, which
 * would be us quietly paying their hosting bill and, worse, putting their
 * agents somewhere they cannot reach.
 */
export async function vercelClientFor(userId: string): Promise<VercelClient> {
  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle<Profile & { vercel_token_enc: string | null }>();

  if (!profile) throw new Error("Profile not found.");

  const selfHosted = hostsOwnAgents(profile);

  if (selfHosted && profile.vercel_token_enc) {
    const token = openSecrets(profile.vercel_token_enc).VERCEL_API_TOKEN;
    if (token) {
      return new VercelClient({
        token,
        teamId: profile.vercel_team_id ?? undefined,
      });
    }
  }

  if (selfHosted && !isAdmin(profile)) {
    throw new Error(
      "Connect your Vercel account first — your plan runs agents on your own infrastructure. It takes about a minute in Settings.",
    );
  }

  // Managed hosting, or an admin without a token: our account.
  return new VercelClient();
}
