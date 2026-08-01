import { timingSafeEqual } from "node:crypto";

/**
 * Every agent is deployed to a public URL, so every route that can spend the
 * founder's OpenAI credits is behind a shared token issued at deploy time.
 */

export function verifyAgentToken(request: Request): { ok: true } | { ok: false; status: number; error: string } {
  const expected = process.env.AGENT_TOKEN;
  if (!expected) {
    return {
      ok: false,
      status: 500,
      error: "AGENT_TOKEN is not set on this deployment.",
    };
  }

  const header = request.headers.get("authorization") ?? "";
  const presented = header.startsWith("Bearer ")
    ? header.slice(7).trim()
    : (request.headers.get("x-agent-token") ?? "").trim();

  if (!presented) {
    return { ok: false, status: 401, error: "Missing bearer token." };
  }
  if (!constantTimeEquals(presented, expected)) {
    return { ok: false, status: 401, error: "Invalid token." };
  }
  return { ok: true };
}

/**
 * Vercel Cron sends its own bearer, so the schedule route accepts either the
 * platform's CRON_SECRET or the agent token.
 */
export function verifyCronRequest(request: Request): boolean {
  const header = request.headers.get("authorization") ?? "";
  const presented = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && presented && constantTimeEquals(presented, cronSecret)) return true;
  return verifyAgentToken(request).ok;
}

function constantTimeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
