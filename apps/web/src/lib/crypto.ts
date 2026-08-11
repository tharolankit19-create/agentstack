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

/**
 * Hex, base64, or base64url — whichever the value actually is.
 *
 * Node's base64 decoder silently skips characters it does not recognise, so
 * feeding it hex produces a plausible-looking buffer of the wrong length
 * rather than an error. That is exactly how a mistyped key turns into a
 * confusing byte count, so each encoding is checked by shape first and only
 * decoded once it matches.
 */
function decodeKey(value: string): Buffer | null {
  if (/^[0-9a-f]{64}$/i.test(value)) return Buffer.from(value, "hex");

  if (/^[A-Za-z0-9+/]{43}=?$/.test(value)) return Buffer.from(value, "base64");

  // base64url, which is what `openssl rand -base64 32 | tr '+/' '-_'` and most
  // token generators produce.
  if (/^[A-Za-z0-9_-]{43}=?$/.test(value)) {
    return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  }

  // Nothing matched a known shape. Decode anyway so the error can report the
  // byte count, which is usually the clue that identifies the mistake.
  const guess = /^[0-9a-f]+$/i.test(value)
    ? Buffer.from(value, "hex")
    : Buffer.from(value, "base64");

  return guess.length > 0 ? guess : null;
}

function encryptionKey(): Buffer {
  if (cachedKey) return cachedKey;

  const raw = process.env.SECRETS_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "SECRETS_ENCRYPTION_KEY is not set. Generate one with:\n" +
        '  node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    );
  }

  // Paste damage, cleaned up before anything is decoded.
  //
  // A value typed into a dashboard field arrives with whatever came along for
  // the ride: a trailing newline, the quotes someone copied from a .env file,
  // a space at the front. None of those change what the operator meant, and
  // all of them used to turn into "must decode to 32 bytes, got 35" — an error
  // that describes the symptom and names none of the causes.
  const cleaned = raw
    .trim()
    .replace(/^["'`]|["'`]$/g, "")
    .replace(/\s+/g, "");

  const key = decodeKey(cleaned);

  if (!key || key.length !== 32) {
    // Say what arrived, without printing the secret itself. Length and shape
    // are enough to work out which mistake was made, and neither is sensitive.
    const shape = /^[0-9a-f]+$/i.test(cleaned)
      ? "hex"
      : /^[A-Za-z0-9+/=_-]+$/.test(cleaned)
        ? "base64"
        : "neither hex nor base64";

    throw new Error(
      `SECRETS_ENCRYPTION_KEY must decode to 32 bytes, but the value set is ` +
        `${cleaned.length} characters of ${shape}` +
        (key ? ` which decodes to ${key.length} bytes` : "") +
        ". Set it to 64 hex characters (the usual form) or 44 base64 " +
        "characters. Generate a correct one with:\n" +
        '  node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
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

/**
 * Constant-time string comparison, for shared secrets that arrive in headers.
 *
 * `===` on a webhook secret leaks its length and its matching prefix through
 * timing. Buffers of different lengths make `timingSafeEqual` throw, so the
 * length check happens first — and it is fine that length is not itself
 * hidden, since an attacker who knows only the length still has to guess the
 * whole value.
 */
export function timingSafeEqualStrings(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/** Shows a key as `sk-…f3a9` so a customer can tell which one they saved. */
export function maskSecret(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 8) return "••••";
  return `${trimmed.slice(0, 3)}…${trimmed.slice(-4)}`;
}
