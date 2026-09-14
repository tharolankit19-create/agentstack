import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { CREDITS_PER_DOLLAR, MIN_TOPUP_USD, TOPUP_STEP_USD } from "@/lib/credits-public";
import { createOneTimeCheckout } from "@/lib/dodo";
import { appUrl } from "@/lib/deploy";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  amountUsd: z.number().int().min(MIN_TOPUP_USD).max(5000).refine((value) => value % TOPUP_STEP_USD === 0),
});

export async function POST(request: Request) {
  const limit = rateLimit(`credits:${clientIp(request)}`, 10, 600);
  if (!limit.allowed) return NextResponse.json({ error: "Too many attempts. Wait a minute and try again." }, { status: 429 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: `Top ups start at $${MIN_TOPUP_USD} and use $${TOPUP_STEP_USD} increments.` }, { status: 400 });
  }

  const productId = process.env.DODO_CREDIT_PRODUCT_ID?.trim();
  if (!productId) {
    return NextResponse.json({ error: "Credit checkout is not configured yet." }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first.", loginRequired: true }, { status: 401 });

  const amountUsd = parsed.data.amountUsd;
  const credits = amountUsd * CREDITS_PER_DOLLAR;
  const quantity = amountUsd / MIN_TOPUP_USD;

  try {
    const checkout = await createOneTimeCheckout({
      productId,
      quantity,
      userId: user.id,
      email: user.email ?? "",
      name: (user.user_metadata?.full_name as string | undefined) ?? (user.user_metadata?.name as string | undefined),
      plan: `credits:${credits}`,
      returnUrl: `${appUrl()}/dashboard/usage?bought=${credits}`,
    });
    return NextResponse.json({ url: checkout.url });
  } catch (cause) {
    console.error("[credits/checkout] failed:", cause);
    return NextResponse.json({ error: "Could not open checkout. Try again in a moment." }, { status: 502 });
  }
}
