import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { packById } from "@/lib/credits-public";
import { createSubscriptionCheckout } from "@/lib/dodo";
import { appUrl } from "@/lib/deploy";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ pack: z.string().min(1).max(40) });

/**
 * Buying credit.
 *
 * A one-off purchase rather than a subscription, which is the whole point of
 * the model: the founder tops up when they want to run hard and stops without
 * cancelling anything. The credits are granted by the webhook, never here —
 * this route only opens a checkout, and a route that granted anything before a
 * payment confirmed would be a way to get credit for free by closing the tab.
 *
 * Sign-in is required so the webhook has an account to credit. That is the only
 * reason for it.
 */
export async function POST(request: Request) {
  const limit = rateLimit(`credits:${clientIp(request)}`, 10, 600);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Wait a minute and try again." },
      { status: 429 },
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  const pack = parsed.success ? packById(parsed.data.pack) : null;
  if (!pack) {
    return NextResponse.json({ error: "Pick a credit pack." }, { status: 400 });
  }

  if (!pack.productId) {
    return NextResponse.json(
      {
        error:
          "Credit packs are not configured yet. Set NEXT_PUBLIC_DODO_PACK_* in the environment.",
      },
      { status: 503 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Sign in first — it takes one click.", loginRequired: true },
      { status: 401 },
    );
  }

  try {
    const checkout = await createSubscriptionCheckout({
      productId: pack.productId,
      userId: user.id,
      email: user.email ?? "",
      name:
        (user.user_metadata?.full_name as string | undefined) ??
        (user.user_metadata?.name as string | undefined),
      // Carried through the provider's metadata so the webhook knows how many
      // credits this payment bought without having to map a price back to a
      // pack — a mapping that breaks the first time a price changes.
      plan: `credits:${pack.id}`,
      returnUrl: `${appUrl()}/dashboard/usage?bought=${pack.credits}`,
    });

    return NextResponse.json({ url: checkout.url });
  } catch (cause) {
    console.error("[credits/checkout] failed:", cause);
    return NextResponse.json(
      { error: "Could not open checkout. Try again in a moment." },
      { status: 502 },
    );
  }
}
