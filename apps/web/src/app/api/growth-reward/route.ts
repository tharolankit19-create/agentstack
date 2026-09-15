import { z } from "zod";
import { requireApiUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const schema = z.object({
  url: z.string().url().max(500),
  impressions: z.coerce.number().int().min(250).max(100_000_000),
});

function rewardFor(impressions: number): number {
  if (impressions >= 5000) return 500;
  if (impressions >= 1000) return 250;
  return 100;
}

function validXUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (host !== "x.com" && host !== "twitter.com") return false;
    return /\/status\/\d+/.test(url.pathname);
  } catch {
    return false;
  }
}

export async function GET() {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const { data, error } = await createAdminClient()
    .from("growth_reward_submissions")
    .select("id, post_url, claimed_impressions, reward_credits, status, review_note, created_at")
    .eq("user_id", auth.session.userId)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    return Response.json({ error: "Growth rewards are temporarily unavailable." }, { status: 503 });
  }
  return Response.json({ submissions: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  if (!rateLimit(`growth-reward:${auth.session.userId}`, 10, 24 * 60 * 60).allowed) {
    return Response.json({ error: "Too many reward submissions today." }, { status: 429 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: "Add an X post link with at least 250 impressions." },
      { status: 400 },
    );
  }

  if (!validXUrl(parsed.data.url)) {
    return Response.json(
      { error: "Use a direct x.com or twitter.com post URL." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { count } = await admin
    .from("growth_reward_submissions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", auth.session.userId)
    .eq("status", "submitted");

  if ((count ?? 0) > 0) {
    return Response.json(
      { error: "You already have a post waiting for review." },
      { status: 409 },
    );
  }

  const reward = rewardFor(parsed.data.impressions);
  const { data, error } = await admin
    .from("growth_reward_submissions")
    .insert({
      user_id: auth.session.userId,
      platform: "x",
      post_url: parsed.data.url,
      claimed_impressions: parsed.data.impressions,
      reward_credits: reward,
      status: "submitted",
    })
    .select("id, reward_credits, status")
    .single();

  if (error) {
    if (error.code === "23505") {
      return Response.json({ error: "That post was already submitted." }, { status: 409 });
    }
    console.error("[growth-reward] submit failed", error);
    return Response.json({ error: "Could not submit that post." }, { status: 503 });
  }

  return Response.json({ submission: data });
}
