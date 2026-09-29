import "server-only";

import { randomBytes } from "node:crypto";
import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "./supabase/admin";
import { hashToken, tokenMatchesHash } from "./crypto";

const ACCESS_PREFIX = "kdv1";
const REFRESH_PREFIX = "kdr1";
const ACCESS_TTL_MS = 30 * 60 * 1000;
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

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
  refreshToken: string;
  sessionId: string;
  expiresAt: string;
  refreshExpiresAt: string;
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

/** Validate an interactive Supabase session when one is explicitly available. */
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

function accessCredential(sessionId: string, secret: string): string {
  return `${ACCESS_PREFIX}.${sessionId}.${secret}`;
}

function refreshCredential(sessionId: string, secret: string): string {
  return `${REFRESH_PREFIX}.${sessionId}.${secret}`;
}

function newSecrets() {
  return {
    access: randomBytes(32).toString("base64url"),
    refresh: randomBytes(32).toString("base64url"),
  };
}

/**
 * Mint one background device session.
 *
 * Both secrets are returned exactly once. Postgres holds hashes only. The
 * desktop persists the refresh credential using Electron safeStorage (macOS
 * Keychain-backed); the access credential is short-lived.
 */
export async function mintDeviceSession(
  admin: Admin,
  input: { deviceId: string; userId: string; userAgent?: string | null },
): Promise<MintedDeviceSession> {
  const secrets = newSecrets();
  const expiresAt = new Date(Date.now() + ACCESS_TTL_MS).toISOString();
  const refreshExpiresAt = new Date(Date.now() + REFRESH_TTL_MS).toISOString();

  const { data, error } = await admin
    .from("device_sessions")
    .insert({
      device_id: input.deviceId,
      user_id: input.userId,
      token_hash: hashToken(secrets.access),
      refresh_token_hash: hashToken(secrets.refresh),
      expires_at: expiresAt,
      refresh_expires_at: refreshExpiresAt,
      user_agent: input.userAgent ?? null,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    throw new Error(error?.message ?? "Could not create a device session.");
  }

  return {
    token: accessCredential(data.id, secrets.access),
    refreshToken: refreshCredential(data.id, secrets.refresh),
    sessionId: data.id,
    expiresAt,
    refreshExpiresAt,
  };
}

function parseCredential(
  request: Request,
  scheme: "Device" | "Device-Refresh",
  prefix: string,
): { sessionId: string; secret: string } | null {
  const header = request.headers.get("authorization")?.trim() ?? "";
  const marker = `${scheme} `;
  if (!header.startsWith(marker)) return null;

  const [actualPrefix, sessionId, secret, extra] = header.slice(marker.length).split(".");
  if (actualPrefix !== prefix || !sessionId || !secret || extra) return null;
  return { sessionId, secret };
}

async function activeDevice(
  admin: Admin,
  deviceId: string,
  userId: string,
): Promise<{
  id: string;
  user_id: string;
  platform: string;
  capabilities: Record<string, unknown> | null;
  permissions: Record<string, unknown> | null;
  revoked_at: string | null;
} | null> {
  const { data } = await admin
    .from("devices")
    .select("id, user_id, platform, capabilities, permissions, revoked_at")
    .eq("id", deviceId)
    .eq("user_id", userId)
    .maybeSingle();

  return data ?? null;
}

/** Authenticate a short-lived background desktop request. */
export async function verifyDeviceRequest(
  request: Request,
): Promise<{ ok: true; device: VerifiedDevice } | { ok: false; response: Response }> {
  const credential = parseCredential(request, "Device", ACCESS_PREFIX);
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

  const device = await activeDevice(admin, session.device_id, session.user_id);
  if (!device || device.revoked_at) {
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

/**
 * Rotate a device refresh credential and access credential in one compare-and-
 * swap. Replaying the old refresh secret loses the hash match after the first
 * successful rotation.
 */
export async function rotateDeviceSession(
  request: Request,
): Promise<
  | { ok: true; session: MintedDeviceSession; device: VerifiedDevice }
  | { ok: false; response: Response }
> {
  const credential = parseCredential(request, "Device-Refresh", REFRESH_PREFIX);
  if (!credential) {
    return {
      ok: false,
      response: noStoreJson({ error: "Device refresh authentication required." }, { status: 401 }),
    };
  }

  const admin = createAdminClient();
  const { data: current } = await admin
    .from("device_sessions")
    .select("id, device_id, user_id, refresh_token_hash, refresh_expires_at, revoked_at")
    .eq("id", credential.sessionId)
    .maybeSingle<{
      id: string;
      device_id: string;
      user_id: string;
      refresh_token_hash: string | null;
      refresh_expires_at: string | null;
      revoked_at: string | null;
    }>();

  const valid =
    current &&
    !current.revoked_at &&
    current.refresh_token_hash &&
    current.refresh_expires_at &&
    Date.parse(current.refresh_expires_at) > Date.now() &&
    tokenMatchesHash(credential.secret, current.refresh_token_hash);

  if (!valid) {
    return {
      ok: false,
      response: noStoreJson({ error: "Device refresh token is invalid or expired." }, { status: 401 }),
    };
  }

  const device = await activeDevice(admin, current.device_id, current.user_id);
  if (!device || device.revoked_at) {
    return {
      ok: false,
      response: noStoreJson({ error: "This Kryx device has been revoked." }, { status: 401 }),
    };
  }

  const secrets = newSecrets();
  const expiresAt = new Date(Date.now() + ACCESS_TTL_MS).toISOString();
  const refreshExpiresAt = new Date(Date.now() + REFRESH_TTL_MS).toISOString();
  const seenAt = new Date().toISOString();

  const { data: rotated, error } = await admin
    .from("device_sessions")
    .update({
      token_hash: hashToken(secrets.access),
      refresh_token_hash: hashToken(secrets.refresh),
      expires_at: expiresAt,
      refresh_expires_at: refreshExpiresAt,
      last_seen_at: seenAt,
    })
    .eq("id", current.id)
    .eq("refresh_token_hash", current.refresh_token_hash)
    .is("revoked_at", null)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error || !rotated) {
    return {
      ok: false,
      response: noStoreJson({ error: "Device refresh token was already used." }, { status: 409 }),
    };
  }

  await admin
    .from("devices")
    .update({ last_seen_at: seenAt, status: "online", updated_at: seenAt })
    .eq("id", device.id);

  return {
    ok: true,
    session: {
      token: accessCredential(current.id, secrets.access),
      refreshToken: refreshCredential(current.id, secrets.refresh),
      sessionId: current.id,
      expiresAt,
      refreshExpiresAt,
    },
    device: {
      id: device.id,
      userId: device.user_id,
      sessionId: current.id,
      platform: device.platform,
      capabilities: device.capabilities ?? {},
      permissions: device.permissions ?? {},
    },
  };
}
