import { Webhook } from "standardwebhooks";

/**
 * Dodo Payments.
 *
 * One-time payments only — AgentStack has no subscription to manage, which
 * removes dunning, proration and cancellation from the product entirely.
 */

export interface CheckoutRequest {
  productId: string;
  userId: string;
  email: string;
  name?: string;
  plan: string;
  returnUrl: string;
}

export interface CheckoutResult {
  url: string;
  reference: string | null;
}

function baseUrl(): string {
  const mode = (process.env.DODO_ENVIRONMENT ?? "test").toLowerCase();
  return mode === "live"
    ? "https://live.dodopayments.com"
    : "https://test.dodopayments.com";
}

function apiKey(): string {
  const key = process.env.DODO_PAYMENTS_API_KEY;
  if (!key) {
    throw new Error(
      "DODO_PAYMENTS_API_KEY is not set. Add it in Vercel before taking payments.",
    );
  }
  return key;
}

/**
 * Creates a hosted checkout.
 *
 * Dodo's newer `/checkouts` endpoint needs no billing address, so it is tried
 * first; `/payments` with `payment_link: true` is the fallback for accounts
 * that have not been migrated to it.
 */
export async function createCheckout(
  request: CheckoutRequest,
): Promise<CheckoutResult> {
  const metadata = {
    user_id: request.userId,
    plan: request.plan,
  };

  const viaCheckouts = await post("/checkouts", {
    product_cart: [{ product_id: request.productId, quantity: 1 }],
    customer: { email: request.email, name: request.name || request.email },
    return_url: request.returnUrl,
    metadata,
  });

  if (viaCheckouts.ok) {
    const url = pickUrl(viaCheckouts.body);
    if (url) {
      return { url, reference: pickString(viaCheckouts.body, ["checkout_id", "session_id"]) };
    }
  }

  const viaPayments = await post("/payments", {
    payment_link: true,
    product_cart: [{ product_id: request.productId, quantity: 1 }],
    customer: { email: request.email, name: request.name || request.email },
    billing: { city: "", country: "US", state: "", street: "", zipcode: "" },
    return_url: request.returnUrl,
    metadata,
  });

  if (!viaPayments.ok) {
    throw new Error(
      `Dodo checkout failed (${viaPayments.status}): ${viaPayments.text.slice(0, 300)}`,
    );
  }

  const url = pickUrl(viaPayments.body);
  if (!url) {
    throw new Error("Dodo returned no payment link.");
  }
  return { url, reference: pickString(viaPayments.body, ["payment_id"]) };
}

async function post(path: string, payload: unknown) {
  const response = await fetch(`${baseUrl()}${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey()}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(20_000),
  });

  const text = await response.text();
  let body: unknown = null;
  try {
    body = JSON.parse(text);
  } catch {
    /* non-JSON error bodies are reported as text */
  }
  return { ok: response.ok, status: response.status, text, body };
}

function pickUrl(body: unknown): string | null {
  return pickString(body, ["checkout_url", "payment_link", "url", "link"]);
}

function pickString(body: unknown, keys: string[]): string | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Webhooks
// ---------------------------------------------------------------------------

export interface DodoWebhookEvent {
  id: string;
  type: string;
  data: Record<string, unknown>;
  raw: Record<string, unknown>;
}

/**
 * Verifies a webhook using the Standard Webhooks scheme Dodo implements.
 *
 * Returns null on any failure. An unverified payment event is treated exactly
 * like no event at all — this is the only thing standing between a stranger
 * with a curl command and a free plan.
 */
export function verifyWebhook(
  rawBody: string,
  headers: Headers,
): DodoWebhookEvent | null {
  const secret = process.env.DODO_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[dodo] DODO_WEBHOOK_SECRET is not set — rejecting webhook.");
    return null;
  }

  const id = headers.get("webhook-id");
  const timestamp = headers.get("webhook-timestamp");
  const signature = headers.get("webhook-signature");

  if (!id || !timestamp || !signature) {
    console.warn("[dodo] webhook is missing standard-webhooks headers.");
    return null;
  }

  try {
    const webhook = new Webhook(secret);
    webhook.verify(rawBody, {
      "webhook-id": id,
      "webhook-timestamp": timestamp,
      "webhook-signature": signature,
    });
  } catch (cause) {
    console.warn(
      `[dodo] webhook signature rejected: ${
        cause instanceof Error ? cause.message : String(cause)
      }`,
    );
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;

  const record = parsed as Record<string, unknown>;
  const data =
    record.data && typeof record.data === "object"
      ? (record.data as Record<string, unknown>)
      : {};

  return {
    id,
    type: String(record.type ?? ""),
    data,
    raw: record,
  };
}

/** Payment events that mean "this customer paid and should get access". */
const SUCCESS_TYPES = new Set([
  "payment.succeeded",
  "payment.completed",
  "checkout.completed",
]);

export function isSuccessfulPayment(event: DodoWebhookEvent): boolean {
  if (!SUCCESS_TYPES.has(event.type)) return false;
  const status = String(event.data.status ?? "").toLowerCase();
  // Some payloads carry the status too; when they do, trust it.
  return status === "" || status === "succeeded" || status === "completed" || status === "paid";
}

export interface PaymentFacts {
  paymentId: string;
  userId: string | null;
  plan: string | null;
  productIds: string[];
  amountCents: number;
  currency: string;
  status: string;
  email: string | null;
}

export function extractPaymentFacts(event: DodoWebhookEvent): PaymentFacts {
  const data = event.data;
  const metadata =
    data.metadata && typeof data.metadata === "object"
      ? (data.metadata as Record<string, unknown>)
      : {};

  const customer =
    data.customer && typeof data.customer === "object"
      ? (data.customer as Record<string, unknown>)
      : {};

  const cart = Array.isArray(data.product_cart) ? data.product_cart : [];
  const productIds = cart
    .map((item) =>
      item && typeof item === "object"
        ? String((item as Record<string, unknown>).product_id ?? "")
        : "",
    )
    .filter(Boolean);

  if (typeof data.product_id === "string") productIds.push(data.product_id);

  return {
    paymentId: String(data.payment_id ?? data.id ?? event.id),
    userId: typeof metadata.user_id === "string" ? metadata.user_id : null,
    plan: typeof metadata.plan === "string" ? metadata.plan : null,
    productIds: [...new Set(productIds)],
    amountCents: Number(data.total_amount ?? data.amount ?? 0) || 0,
    currency: String(data.currency ?? "USD"),
    status: String(data.status ?? "succeeded"),
    email: typeof customer.email === "string" ? customer.email : null,
  };
}
