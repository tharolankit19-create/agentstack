import "server-only";

import {
  createHash,
  createPrivateKey,
  createPublicKey,
  sign,
} from "node:crypto";

export const DEVICE_TASK_KEY_ID = "kryx-device-v1";

export interface SignedTaskEnvelope {
  alg: "Ed25519";
  kid: string;
  payload: string;
  signature: string;
}

/**
 * Ed25519 PKCS#8 prefix for a raw 32-byte seed (RFC 8410).
 * The seed is derived from the existing permanent Kryx vault key when a
 * dedicated task-signing key is not configured.
 */
const ED25519_PKCS8_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");

function signingKey() {
  const explicit = process.env.DEVICE_TASK_SIGNING_PRIVATE_KEY_B64?.trim();
  if (explicit) {
    return createPrivateKey({
      key: Buffer.from(explicit, "base64"),
      format: "der",
      type: "pkcs8",
    });
  }

  const vault = process.env.SECRETS_ENCRYPTION_KEY?.trim();
  if (!vault) {
    throw new Error(
      "No device task signing identity is available. Configure SECRETS_ENCRYPTION_KEY or DEVICE_TASK_SIGNING_PRIVATE_KEY_B64.",
    );
  }

  const seed = createHash("sha256")
    .update("kryx-device-task-signing-v1\0")
    .update(vault)
    .digest();

  return createPrivateKey({
    key: Buffer.concat([ED25519_PKCS8_PREFIX, seed]),
    format: "der",
    type: "pkcs8",
  });
}

export function taskSigningPublicKeyB64(): string {
  return createPublicKey(signingKey())
    .export({ format: "der", type: "spki" })
    .toString("base64");
}

export function signDeviceTaskPayload(payload: Record<string, unknown>): SignedTaskEnvelope {
  const bytes = Buffer.from(JSON.stringify(payload), "utf8");
  const signature = sign(null, bytes, signingKey());

  return {
    alg: "Ed25519",
    kid: DEVICE_TASK_KEY_ID,
    payload: bytes.toString("base64url"),
    signature: signature.toString("base64url"),
  };
}
