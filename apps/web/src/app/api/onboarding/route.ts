import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { PROBLEMS, SPEND_BANDS } from "@/lib/onboarding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  fullName: z.string().min(1).max(80),
  company: z.string().max(120).optional(),
  problems: z.array(z.string().max(60)).min(1).max(6),
  spendBand: z.string().max(40),
  tools: z.array(z.string().max(60)).max(40).optional(),
});

/**
 * Finishes onboarding.
 *
 * Written with the service role because `onboarded_at` is the gate on the
 * dashboard, and the customer's own RLS policy deliberately cannot touch
 * anything that grants access. Everything here is still their own data — the
 * row is pinned to their session's user id, never one from the body.
 */
export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Fill in your name and pick at least one problem." },
      { status: 400 },
    );
  }

  const { fullName, company, problems, spendBand, tools } = parsed.data;

  // Only ids we actually offered. A crafted body cannot write arbitrary text
  // into a field the dashboard later renders.
  const validProblems = problems.filter((id) =>
    PROBLEMS.some((problem) => problem.id === id),
  );
  if (validProblems.length === 0) {
    return NextResponse.json({ error: "Pick at least one problem." }, { status: 400 });
  }

  const band = SPEND_BANDS.find((b) => b.id === spendBand);

  const { error } = await createAdminClient()
    .from("profiles")
    .update({
      full_name: fullName.trim(),
      company: company?.trim() || null,
      problems: validProblems,
      monthly_spend: band ? band.midpoint : null,
      current_tools: (tools ?? []).slice(0, 40),
      onboarded_at: new Date().toISOString(),
    })
    .eq("id", auth.session.userId);

  if (error) {
    console.error("[onboarding] could not save:", error);
    return NextResponse.json({ error: "Could not save that." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
