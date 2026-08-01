import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { PLANS } from "@/lib/plans";
import { createCheckout } from "@/lib/dodo";
import { appUrl } from "@/lib/deploy";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ plan: z.enum(["starter", "pro"]) });

/**
 * Starts a hosted checkout.
 *
 * Sign-in comes first, so the webhook has a user to grant the plan to. That is
 * the only reason: nothing else about the product needs an account before
 * payment.
 */
export async function POST(request: Request) {
  const limit = rateLimit(`checkout:${clientIp(request)}`, 10, 600);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Wait a minute and try again." },
      { status: 429 },
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Pick a plan." }, { status: 400 });
  }

  const plan = PLANS[parsed.data.plan];
  if (!plan.productId) {
    return NextResponse.json(
      {
        error:
          "Checkout is not configured yet. Set the Dodo product ids in the environment.",
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
    const checkout = await createCheckout({
      productId: plan.productId,
      userId: user.id,
      email: user.email ?? "",
      name:
        (user.user_metadata?.full_name as string | undefined) ??
        (user.user_metadata?.name as string | undefined),
      plan: plan.tier,
      returnUrl: `${appUrl()}/checkout/success?plan=${plan.tier}`,
    });

    return NextResponse.json({ url: checkout.url });
  } catch (cause) {
    console.error("[checkout] failed:", cause);
    return NextResponse.json(
      { error: "Could not open checkout. Try again in a moment." },
      { status: 502 },
    );
  }
}
