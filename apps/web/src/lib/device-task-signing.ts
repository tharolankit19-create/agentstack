import "server-only";

import { createPrivateKey, sign } from "node:crypto";

export const DEVICE_TASK_KEY_ID = "kryx-device-v1";

export interface SignedTaskEnvelope {
  alg: "Ed25519";
  kid: string;
  payload: string;
  signature: string;
}

function signingKey() {
  const encoded = process.env.DEVICE_TASK_SIGNING_PRIVATE_KEY_B64?.trim();
  if (!encoded) {
    throw new Error(
      "DEVICE_TASK_SIGNING_PRIVATE_KEY_B64 is not configured. Device tasks cannot be dispatched unsigned.",
    );
  }

  return createPrivateKey({
    key: Buffer.from(encoded, "base64"),
    format: "der",
    type: "pkcs8",
  });
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
