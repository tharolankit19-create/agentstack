/**
 * In-memory rate limiter.
 *
 * Honest about what it is: serverless instances do not share memory, so this
 * caps abuse per instance rather than globally. That is enough to stop a
 * script from emptying the platform's OpenAI balance in one burst, and it
 * costs no extra infrastructure. If the free demo ever gets seriously abused,
 * swap the store here for Upstash — the call sites do not change.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const MAX_KEYS = 10_000;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetInSeconds: number;
}

export function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    if (buckets.size >= MAX_KEYS) evictExpired(now);
    buckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { allowed: true, remaining: limit - 1, resetInSeconds: windowSeconds };
  }

  existing.count += 1;
  const resetInSeconds = Math.ceil((existing.resetAt - now) / 1000);

  return {
    allowed: existing.count <= limit,
    remaining: Math.max(0, limit - existing.count),
    resetInSeconds,
  };
}

function evictExpired(now: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
  // Still full of live buckets? Drop the oldest insertions.
  if (buckets.size >= MAX_KEYS) {
    let toDrop = Math.ceil(MAX_KEYS / 4);
    for (const key of buckets.keys()) {
      buckets.delete(key);
      if (--toDrop <= 0) break;
    }
  }
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
