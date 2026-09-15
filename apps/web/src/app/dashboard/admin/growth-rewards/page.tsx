import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isAdmin } from "@/lib/plans";
import { createAdminClient } from "@/lib/supabase/admin";
import { GrowthRewardReview } from "@/components/dashboard/growth-reward-review";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  user_id: string;
  post_url: string;
  claimed_impressions: number;
  reward_credits: number;
  status: "submitted" | "approved" | "rejected";
  review_note: string | null;
  created_at: string;
};

export default async function GrowthRewardsAdmin({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const auth = await requireUser("/dashboard/admin/growth-rewards");
  if (!isAdmin(auth.profile)) notFound();

  const params = await searchParams;
  const status = ["submitted", "approved", "rejected"].includes(params.status ?? "")
    ? params.status!
    : "submitted";

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("growth_reward_submissions")
    .select("*")
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return (
      <div className="max-w-4xl space-y-4">
        <Link href="/dashboard/admin" className="text-sm underline">Back to admin</Link>
        <p role="alert">Growth rewards are not installed yet. Apply migration 0029.</p>
      </div>
    );
  }

  const rows = (data ?? []) as Row[];
  const profiles = rows.length
    ? await admin.from("profiles").select("id,email").in("id", rows.map((row) => row.user_id))
    : { data: [], error: null };

  return (
    <div className="max-w-4xl space-y-6">
      <Link href="/dashboard/admin" className="text-sm underline">Back to admin</Link>
      <div>
        <h1 className="text-3xl font-bold text-fg-strong">X reward reviews</h1>
        <p className="mt-2 text-sm text-muted">
          Verify the post is public and that its visible impression count reaches the claimed tier before approving.
        </p>
      </div>

      <nav className="flex gap-4 text-sm">
        {["submitted", "approved", "rejected"].map((item) => (
          <Link
            key={item}
            href={`?status=${item}`}
            className={item === status ? "font-bold underline" : "text-muted"}
          >
            {item}
          </Link>
        ))}
      </nav>

      <div className="space-y-3">
        {rows.map((row) => (
          <article key={row.id} className="rounded-2xl border border-line bg-surface p-5">
            <p className="font-bold text-fg-strong">
              {profiles.data?.find((profile) => profile.id === row.user_id)?.email ?? row.user_id}
            </p>
            <a
              href={row.post_url}
              target="_blank"
              rel="noreferrer"
              className="mt-2 block break-all text-sm font-semibold text-accent underline"
            >
              {row.post_url}
            </a>
            <p className="mt-2 text-sm text-muted">
              Claimed {row.claimed_impressions.toLocaleString()} impressions · {row.reward_credits} credits
            </p>
            <p className="mt-1 text-xs text-faint">{row.created_at}</p>
            {row.review_note ? <p className="mt-3 text-sm text-muted">Review note: {row.review_note}</p> : null}
            <GrowthRewardReview id={row.id} status={row.status} credits={row.reward_credits} />
          </article>
        ))}
        {!rows.length ? <p className="text-sm text-muted">No submissions in this view.</p> : null}
      </div>
    </div>
  );
}
