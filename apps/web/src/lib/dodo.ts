import { Webhook } from "standardwebhooks";

/**
 * Dodo Payments — recurring subscriptions.
 *
 * Everything here treats access as revocable. A subscription is not a receipt
 * you check once; it is a state that changes underneath you, and the webhook
 * handler is the only thing that knows when.
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
    throw new Error("DODO_PAYMENTS_API_KEY is not set. Add it before taking payments.");
  }
  return key;
}

/**
 * Opens a hosted checkout for a recurring plan.
 *
 * `/subscriptions` is the endpoint that creates a recurring billing agreement;
 * `/checkouts` is tried first because it needs no billing address, and falls
 * back for accounts where it is not enabled.
 */
export async function createSubscriptionCheckout(
  request: CheckoutRequest,
): Promise<CheckoutResult> {
  const metadata = { user_id: request.userId, plan: request.plan };
  const customer = { email: request.email, name: request.name || request.email };

  const viaCheckouts = await post("/checkouts", {
    product_cart: [{ product_id: request.productId, quantity: 1 }],
    customer,
    return_url: request.returnUrl,
    metadata,
  });

  if (viaCheckouts.ok) {
    const url = pickUrl(viaCheckouts.body);
    if (url) {
      return {
        url,
        reference: pickString(viaCheckouts.body, ["checkout_id", "session_id"]),
      };
    }
  }

  const viaSubscriptions = await post("/subscriptions", {
    product_id: request.productId,
    quantity: 1,
    payment_link: true,
    customer,
    billing: { city: "", country: "US", state: "", street: "", zipcode: "" },
    return_url: request.returnUrl,
    metadata,
  });

  if (!viaSubscriptions.ok) {
    throw new Error(
      `Dodo checkout failed (${viaSubscriptions.status}): ${viaSubscriptions.text.slice(0, 300)}`,
    );
  }

  const url = pickUrl(viaSubscriptions.body);
  if (!url) throw new Error("Dodo returned no payment link.");

  return { url, reference: pickString(viaSubscriptions.body, ["subscription_id"]) };
}

/**
 * Cancels at the end of the paid period.
 *
 * Not immediately: the customer paid through a date, and taking their agents
 * away early over a cancel click is the kind of thing that gets screenshotted.
 */
export async function cancelSubscription(subscriptionId: string): Promise<void> {
  const response = await post(`/subscriptions/${subscriptionId}`, {
    status: "cancelled",
    cancel_at_next_billing_date: true,
  }, "PATCH");

  if (!response.ok) {
    throw new Error(
      `Could not cancel the subscription (${response.status}): ${response.text.slice(0, 200)}`,
    );
  }
}

/** A customer-facing billing portal link, when the provider gives us one. */
export async function customerPortalUrl(customerId: string): Promise<string | null> {
  const response = await post(
    `/customers/${customerId}/customer-portal/session`,
    {},
  );
  return response.ok ? pickString(response.body, ["link", "url"]) : null;
}

async function post(path: string, payload: unknown, method = "POST") {
  const response = await fetch(`${baseUrl()}${path}`, {
    method,
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
 * Returns null on any failure. An unverified event is treated exactly like no
 * event at all — this is the only thing between a stranger with a curl command
 * and a free subscription.
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
    new Webhook(secret).verify(rawBody, {
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

  return { id, type: String(record.type ?? ""), data, raw: record };
}

/** What an event means for the customer's access. */
export type AccessChange = "grant" | "revoke" | "ignore";

const GRANT_TYPES = new Set([
  "subscription.active",
  "subscription.renewed",
  "subscription.plan_changed",
  "payment.succeeded",
]);

const REVOKE_TYPES = new Set([
  "subscription.expired",
  "subscription.failed",
  "subscription.cancelled",
  "subscription.on_hold",
]);

export function accessChangeFor(event: DodoWebhookEvent): AccessChange {
  if (GRANT_TYPES.has(event.type)) {
    const status = String(event.data.status ?? "").toLowerCase();
    // `subscription.cancelled` with a future end date arrives as its own event;
    // a grant event whose payload already says cancelled is not a grant.
    if (status === "cancelled" || status === "expired") return "revoke";
    return "grant";
  }

  if (REVOKE_TYPES.has(event.type)) {
    // A cancellation scheduled for the end of the period is not a revocation
    // today — the customer paid through their period end.
    if (event.type === "subscription.cancelled" && periodEnd(event.data)) {
      const end = new Date(periodEnd(event.data) as string).getTime();
      if (Number.isFinite(end) && end > Date.now()) return "ignore";
    }
    return "revoke";
  }

  return "ignore";
}

export interface SubscriptionFacts {
  eventId: string;
  subscriptionId: string | null;
  paymentId: string | null;
  userId: string | null;
  plan: string | null;
  productIds: string[];
  amountCents: number;
  currency: string;
  status: string;
  email: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

export function extractFacts(event: DodoWebhookEvent): SubscriptionFacts {
  const data = event.data;
  const metadata = asRecord(data.metadata);
  const customer = asRecord(data.customer);

  const cart = Array.isArray(data.product_cart) ? data.product_cart : [];
  const productIds = cart
    .map((item) => String(asRecord(item).product_id ?? ""))
    .filter(Boolean);
  if (typeof data.product_id === "string") productIds.push(data.product_id);

  return {
    eventId: event.id,
    subscriptionId:
      typeof data.subscription_id === "string" ? data.subscription_id : null,
    paymentId: typeof data.payment_id === "string" ? data.payment_id : null,
    userId: typeof metadata.user_id === "string" ? metadata.user_id : null,
    plan: typeof metadata.plan === "string" ? metadata.plan : null,
    productIds: [...new Set(productIds)],
    amountCents: Number(data.total_amount ?? data.amount ?? data.recurring_pre_tax_amount ?? 0) || 0,
    currency: String(data.currency ?? "USD"),
    status: String(data.status ?? ""),
    email: typeof customer.email === "string" ? customer.email : null,
    currentPeriodEnd: periodEnd(data),
    cancelAtPeriodEnd: Boolean(
      data.cancel_at_next_billing_date ?? data.cancel_at_period_end ?? false,
    ),
  };
}

function periodEnd(data: Record<string, unknown>): string | null {
  for (const key of [
    "next_billing_date",
    "current_period_end",
    "expires_at",
    "previous_billing_date",
  ]) {
    const value = data[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}
