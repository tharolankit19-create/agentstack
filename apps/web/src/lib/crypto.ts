import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

/**
 * The secret vault.
 *
 * Customer API keys are encrypted here before they touch the database, with a
 * key that lives only in the platform's Vercel environment. A dump of the
 * Postgres tables — or a leaked service role key — yields ciphertext.
 *
 * AES-256-GCM: authenticated, so tampered ciphertext fails loudly instead of
 * decrypting into garbage.
 */

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12; // 96-bit nonce, the size GCM is specified for
const VERSION = "v1";

let cachedKey: Buffer | null = null;

function encryptionKey(): Buffer {
  if (cachedKey) return cachedKey;

  const raw = process.env.SECRETS_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "SECRETS_ENCRYPTION_KEY is not set. Generate one with:\n" +
        '  node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    );
  }

  const key = /^[0-9a-f]{64}$/i.test(raw.trim())
    ? Buffer.from(raw.trim(), "hex")
    : Buffer.from(raw.trim(), "base64");

  if (key.length !== 32) {
    throw new Error(
      `SECRETS_ENCRYPTION_KEY must decode to 32 bytes, got ${key.length}. ` +
        "Use 64 hex characters or 44 base64 characters.",
    );
  }

  cachedKey = key;
  return key;
}

/** Encrypts a secret map into a single opaque string safe to store. */
export function sealSecrets(secrets: Record<string, string>): string {
  return encrypt(JSON.stringify(secrets));
}

/** Reverses `sealSecrets`. Only ever called on the server, at deploy time. */
export function openSecrets(envelope: string): Record<string, string> {
  const parsed: unknown = JSON.parse(decrypt(envelope));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Decrypted secret payload was not an object.");
  }
  return Object.fromEntries(
    Object.entries(parsed as Record<string, unknown>).map(([k, v]) => [k, String(v)]),
  );
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decrypt(envelope: string): string {
  const parts = envelope.split(".");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error("Malformed secret envelope.");
  }

  const [, ivPart, tagPart, dataPart] = parts;
  const decipher = createDecipheriv(
    ALGORITHM,
    encryptionKey(),
    Buffer.from(ivPart, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(dataPart, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

/** Token an agent deployment presents when it reports a run back. */
export function generateAgentToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function tokenMatchesHash(token: string, hash: string): boolean {
  const presented = Buffer.from(hashToken(token), "hex");
  const expected = Buffer.from(hash, "hex");
  if (presented.length !== expected.length) return false;
  return timingSafeEqual(presented, expected);
}

/** Shows a key as `sk-…f3a9` so a customer can tell which one they saved. */
export function maskSecret(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 8) return "••••";
  return `${trimmed.slice(0, 3)}…${trimmed.slice(-4)}`;
}
