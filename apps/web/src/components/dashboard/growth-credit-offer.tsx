"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Loader2, Megaphone } from "lucide-react";

type Submission = {
  id: string;
  post_url: string;
  claimed_impressions: number;
  reward_credits: number;
  status: "submitted" | "approved" | "rejected";
  review_note: string | null;
  created_at: string;
};

function rewardFor(impressions: number) {
  if (impressions >= 5000) return 500;
  if (impressions >= 1000) return 250;
  if (impressions >= 250) return 100;
  return 0;
}

export function GrowthCreditOffer() {
  const [url, setUrl] = useState("");
  const [impressions, setImpressions] = useState(250);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const reward = useMemo(() => rewardFor(impressions), [impressions]);
  const waiting = submissions.find((submission) => submission.status === "submitted");

  useEffect(() => {
    let active = true;
    fetch("/api/growth-reward", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
        const payload = (await response.json()) as { submissions?: Submission[] };
        if (active) setSubmissions(payload.submissions ?? []);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function submit() {
    if (pending || waiting) return;
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/growth-reward", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url, impressions }),
      });
      const payload = (await response.json()) as {
        error?: string;
        submission?: Submission;
      };
      if (!response.ok) throw new Error(payload.error ?? "Could not submit the post.");
      setMessage(
        `Submitted for manual review. Up to ${payload.submission?.reward_credits ?? reward} credits if the public view count checks out.`,
      );
      const refresh = await fetch("/api/growth-reward", { cache: "no-store" });
      if (refresh.ok) {
        const next = (await refresh.json()) as { submissions?: Submission[] };
        setSubmissions(next.submissions ?? []);
      }
      setUrl("");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Could not submit the post.");
    } finally {
      setPending(false);
    }
  }

  const draftPrompt = encodeURIComponent(
    "Write one short X post about my real experience using KryxAI. Use what you know about my workspace and recent work. No hype, no fake results, no hashtags unless useful. Give me 3 distinct versions.",
  );

  return (
    <section className="overflow-hidden rounded-[24px] border border-line bg-surface">
      <div className="grid gap-0 lg:grid-cols-[.78fr_1.22fr]">
        <div className="border-b border-line bg-surface-2 p-5 sm:p-6 lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-2xl bg-accent-wash text-accent">
              <Megaphone className="size-5" />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[.12em] text-faint">
                Earn credits
              </p>
              <h2 className="mt-1 text-xl font-extrabold text-fg-strong">
                Post about Kryx on X.
              </h2>
            </div>
          </div>

          <div className="mt-5 grid gap-2">
            {[
              ["250+ impressions", "100 credits"],
              ["1,000+ impressions", "250 credits"],
              ["5,000+ impressions", "500 credits"],
            ].map(([views, credits]) => (
              <div
                key={views}
                className="flex items-center justify-between rounded-xl border border-line bg-surface px-3 py-2.5 text-sm"
              >
                <span className="text-muted">{views}</span>
                <span className="font-bold text-fg-strong">{credits}</span>
              </div>
            ))}
          </div>

          <p className="mt-4 text-xs leading-5 text-muted">
            One post can be pending at a time. We verify the public post and
            view count before crediting the wallet. A post can only be rewarded once.
          </p>

          <Link
            href={`/dashboard/room?prompt=${draftPrompt}`}
            className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-fg-strong hover:text-accent"
          >
            Ask Kryx to draft it <ArrowRight className="size-4" />
          </Link>
        </div>

        <div className="p-5 sm:p-6">
          {loading ? (
            <p className="flex items-center gap-2 text-sm text-muted">
              <Loader2 className="size-4 animate-spin" /> Loading reward status…
            </p>
          ) : waiting ? (
            <div className="rounded-2xl border border-line bg-surface-2 p-4">
              <p className="flex items-center gap-2 font-bold text-fg-strong">
                <CheckCircle2 className="size-4 text-accent" />
                Waiting for review
              </p>
              <p className="mt-2 break-all text-sm text-muted">{waiting.post_url}</p>
              <p className="mt-2 text-xs text-faint">
                Claimed {waiting.claimed_impressions.toLocaleString()} impressions ·
                {waiting.reward_credits} credits if verified
              </p>
            </div>
          ) : (
            <>
              <label className="block">
                <span className="text-xs font-semibold text-muted">X post URL</span>
                <input
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://x.com/you/status/..."
                  className="mt-2 h-12 w-full rounded-xl border border-line bg-surface-2 px-3 text-sm text-fg placeholder:text-faint focus:border-accent focus:outline-none"
                />
              </label>

              <label className="mt-4 block">
                <span className="text-xs font-semibold text-muted">
                  Current public impressions
                </span>
                <input
                  type="number"
                  min={250}
                  step={1}
                  value={impressions}
                  onChange={(event) => setImpressions(Number(event.target.value || 0))}
                  className="mt-2 h-12 w-full rounded-xl border border-line bg-surface-2 px-3 text-sm text-fg focus:border-accent focus:outline-none"
                />
              </label>

              <div className="mt-4 flex items-center justify-between rounded-xl border border-line bg-bg px-3 py-3">
                <span className="text-sm text-muted">Eligible if verified</span>
                <span className="text-sm font-extrabold text-fg-strong">
                  {reward ? `${reward} credits` : "250 views minimum"}
                </span>
              </div>

              <button
                type="button"
                onClick={() => void submit()}
                disabled={pending || !url.trim() || reward === 0}
                className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-fg-strong px-4 text-sm font-bold text-bg disabled:opacity-45"
              >
                {pending ? <Loader2 className="size-4 animate-spin" /> : null}
                {pending ? "Submitting…" : "Submit for review"}
              </button>
            </>
          )}

          {message ? (
            <p className="mt-3 text-sm leading-6 text-muted">{message}</p>
          ) : null}

          {submissions.find((submission) => submission.status === "approved") ? (
            <p className="mt-4 text-xs font-semibold text-live">
              Your latest approved X reward has already been added to your credit balance.
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
