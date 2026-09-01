import "server-only";

/**
 * Sending, through the founder's own Resend account.
 *
 * Their account and their domain on purpose. Cold email sent from a shared
 * platform domain would put every customer's reputation in one bucket, where
 * one careless founder burns deliverability for everybody — and the founder who
 * did nothing wrong has no way to see it happening or fix it.
 */

const BASE_URL = "https://api.resend.com";

export interface SendResult {
  ok: boolean;
  id: string | null;
  /** One line, written for the founder rather than for a log. */
  error: string | null;
}

export async function sendEmail(
  apiKey: string,
  message: { from: string; to: string; subject: string; text: string; replyTo?: string },
): Promise<SendResult> {
  try {
    const response = await fetch(`${BASE_URL}/emails`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: message.from,
        to: [message.to],
        subject: message.subject,
        // Plain text only. An HTML cold email from a stranger looks like a
        // newsletter to a filter and like marketing to a human; the whole
        // premise of this email is that a person typed it.
        text: message.text,
        ...(message.replyTo ? { reply_to: message.replyTo } : {}),
      }),
      signal: AbortSignal.timeout(20_000),
    });

    const data = (await response.json().catch(() => ({}))) as {
      id?: string;
      message?: string;
      name?: string;
    };

    if (!response.ok) {
      // The two a founder can actually fix, named as such. Anything else is
      // passed through rather than flattened into "sending failed".
      const message =
        response.status === 401
          ? "Resend rejected the API key."
          : response.status === 403
            ? "Resend refused: the sending domain is probably not verified yet."
            : data.message ?? `Resend returned ${response.status}.`;
      return { ok: false, id: null, error: message };
    }

    return { ok: true, id: data.id ?? null, error: null };
  } catch (cause) {
    const timedOut = cause instanceof Error && cause.name === "TimeoutError";
    return {
      ok: false,
      id: null,
      error: timedOut ? "Resend took too long." : "Could not reach Resend.",
    };
  }
}

/**
 * Whether a from-address is usable, before a batch is attempted.
 *
 * A malformed or missing sender fails every send identically, and finding that
 * out one lead at a time marks a whole batch `failed` for a reason that had
 * nothing to do with the leads.
 */
export function validFrom(from: string | null | undefined): boolean {
  if (!from) return false;
  // Accepts a bare address or a "Name <address>" pair.
  return /^(?:[^<>]+<\s*)?[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+\s*>?$/.test(from.trim());
}
