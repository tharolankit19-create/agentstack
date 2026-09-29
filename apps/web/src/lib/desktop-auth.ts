import "server-only";

import { randomBytes } from "node:crypto";
import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "./supabase/admin";
import { hashToken, tokenMatchesHash } from "./crypto";

const DEVICE_PREFIX = "kdv1";
const SESSION_TTL_MS = 30 * 60 * 1000;

type Admin = ReturnType<typeof createAdminClient>;

export interface DesktopUserAuth {
  user: User;
  accessToken: string;
}

export interface VerifiedDevice {
  id: string;
  userId: string;
  sessionId: string;
  platform: string;
  capabilities: Record<string, unknown>;
  permissions: Record<string, unknown>;
}

export interface MintedDeviceSession {
  token: string;
  sessionId: string;
  expiresAt: string;
}

function noStoreJson(body: unknown, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store");
  return Response.json(body, { ...init, headers });
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization")?.trim() ?? "";
  if (!header.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return token || null;
}

/**
 * Validate the Supabase access token presented by the interactive desktop
 * login. We intentionally call Auth instead of trusting decoded client state.
 */
export async function requireDesktopUser(
  request: Request,
): Promise<{ ok: true; auth: DesktopUserAuth } | { ok: false; response: Response }> {
  const token = bearerToken(request);
  if (!token) {
    return {
      ok: false,
      response: noStoreJson({ error: "A signed-in Kryx session is required." }, { status: 401 }),
    };
  }

  const admin = createAdminClient();
  const {
    data: { user },
    error,
  } = await admin.auth.getUser(token);

  if (error || !user) {
    return {
      ok: false,
      response: noStoreJson({ error: "The Kryx session is invalid or expired." }, { status: 401 }),
    };
  }

  return { ok: true, auth: { user, accessToken: token } };
}

/**
 * Device credentials are opaque bearer secrets, separate from the founder's
 * Supabase refresh token. Only the SHA-256 hash is persisted.
 */
export async function mintDeviceSession(
  admin: Admin,
  input: { deviceId: string; userId: string; userAgent?: string | null },
): Promise<MintedDeviceSession> {
  const secret = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();

  const { data, error } = await admin
    .from("device_sessions")
    .insert({
      device_id: input.deviceId,
      user_id: input.userId,
      token_hash: hashToken(secret),
      expires_at: expiresAt,
      user_agent: input.userAgent ?? null,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    throw new Error(error?.message ?? "Could not create a device session.");
  }

  return {
    token: `${DEVICE_PREFIX}.${data.id}.${secret}`,
    sessionId: data.id,
    expiresAt,
  };
}

function parseDeviceCredential(request: Request): {
  sessionId: string;
  secret: string;
} | null {
  const header = request.headers.get("authorization")?.trim() ?? "";
  if (!header.startsWith("Device ")) return null;

  const [prefix, sessionId, secret, extra] = header.slice("Device ".length).split(".");
  if (prefix !== DEVICE_PREFIX || !sessionId || !secret || extra) return null;
  return { sessionId, secret };
}

/**
 * Authenticate a background desktop request.
 *
 * A valid hash is not enough: both the session and the device must still be
 * active. Revoking the device therefore takes effect immediately without
 * waiting for the 30-minute credential to expire.
 */
export async function verifyDeviceRequest(
  request: Request,
): Promise<{ ok: true; device: VerifiedDevice } | { ok: false; response: Response }> {
  const credential = parseDeviceCredential(request);
  if (!credential) {
    return {
      ok: false,
      response: noStoreJson({ error: "Device authentication required." }, { status: 401 }),
    };
  }

  const admin = createAdminClient();
  const { data: session, error: sessionError } = await admin
    .from("device_sessions")
    .select("id, device_id, user_id, token_hash, expires_at, revoked_at")
    .eq("id", credential.sessionId)
    .maybeSingle<{
      id: string;
      device_id: string;
      user_id: string;
      token_hash: string;
      expires_at: string;
      revoked_at: string | null;
    }>();

  const expired = !session || Date.parse(session.expires_at) <= Date.now();
  const secretMatches =
    Boolean(session?.token_hash) &&
    tokenMatchesHash(credential.secret, session!.token_hash);

  if (sessionError || !session || session.revoked_at || expired || !secretMatches) {
    return {
      ok: false,
      response: noStoreJson({ error: "Device session is invalid or expired." }, { status: 401 }),
    };
  }

  const { data: device, error: deviceError } = await admin
    .from("devices")
    .select("id, user_id, platform, capabilities, permissions, revoked_at")
    .eq("id", session.device_id)
    .eq("user_id", session.user_id)
    .maybeSingle<{
      id: string;
      user_id: string;
      platform: string;
      capabilities: Record<string, unknown> | null;
      permissions: Record<string, unknown> | null;
      revoked_at: string | null;
    }>();

  if (deviceError || !device || device.revoked_at) {
    return {
      ok: false,
      response: noStoreJson({ error: "This Kryx device has been revoked." }, { status: 401 }),
    };
  }

  const seenAt = new Date().toISOString();
  await Promise.all([
    admin.from("device_sessions").update({ last_seen_at: seenAt }).eq("id", session.id),
    admin
      .from("devices")
      .update({ last_seen_at: seenAt, status: "online", updated_at: seenAt })
      .eq("id", device.id),
  ]);

  return {
    ok: true,
    device: {
      id: device.id,
      userId: device.user_id,
      sessionId: session.id,
      platform: device.platform,
      capabilities: device.capabilities ?? {},
      permissions: device.permissions ?? {},
    },
  };
}
