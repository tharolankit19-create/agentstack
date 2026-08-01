"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";

interface DemoResult {
  site: { title: string; url: string };
  tweets: string[];
  linkedin: string[];
}

/**
 * The Content Agent, running on the landing page, for free, before signup.
 *
 * This is the demo and the sales pitch in one. Anyone can paste a URL and read
 * what the agent actually writes about *their* product — the drafts are real,
 * generated live, and free to copy. If the output is not good enough to give
 * away, it is not good enough to sell.
 */
export function Demo() {
  const [url, setUrl] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DemoResult | null>(null);

  async function run(event: React.FormEvent) {
    event.preventDefault();
    if (!url.trim() || pending) return;

    setPending(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/demo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const payload = (await response.json()) as DemoResult & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "That did not work.");
      setResult(payload);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper-soft)] p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-[var(--color-ink)]">
        <Sparkles className="size-4 text-[var(--color-accent)]" />
        Try the Content Agent right now. No signup.
      </div>

      <form onSubmit={run} className="flex flex-col gap-2.5 sm:flex-row">
        <input
          type="url"
          required
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://yourproduct.com"
          aria-label="Your website URL"
          className="h-12 flex-1 rounded-lg border border-[var(--color-line)] bg-white px-4 text-[15px] text-[var(--color-ink)] placeholder:text-[var(--color-ink-faint)] focus:border-[var(--color-accent)] focus:outline-none"
        />
        <Button type="submit" disabled={pending} size="md" className="h-12">
          {pending ? <Loader2 className="animate-spin" /> : null}
          {pending ? "Reading your site…" : "Write my posts"}
        </Button>
      </form>

      {error ? (
        <p role="alert" className="mt-3 text-sm font-medium text-red-600">
          {error}
        </p>
      ) : null}

      {pending ? (
        <div className="mt-5 space-y-2.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="shimmer h-16 rounded-lg bg-white" />
          ))}
          <p className="text-xs text-[var(--color-ink-faint)]">
            Reading your homepage, then writing. Takes about 15 seconds.
          </p>
        </div>
      ) : null}

      {result ? (
        <div className="animate-in-up mt-5 space-y-4">
          <p className="text-xs font-medium text-[var(--color-ink-soft)]">
            Written from{" "}
            <span className="font-semibold text-[var(--color-ink)]">
              {result.site.title || result.site.url}
            </span>
            . Yours to keep.
          </p>

          <DraftList title="Tweets" drafts={result.tweets} />
          <DraftList title="LinkedIn" drafts={result.linkedin} />

          <p className="border-t border-[var(--color-line)] pt-4 text-sm text-[var(--color-ink-soft)]">
            That was one run.{" "}
            <span className="font-semibold text-[var(--color-ink)]">
              The paid agent does this every weekday at 9am
            </span>{" "}
            on its own URL, and posts them for you if you let it.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function DraftList({ title, drafts }: { title: string; drafts: string[] }) {
  if (drafts.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-ink-faint)]">
        {title}
      </p>
      {drafts.map((draft, index) => (
        <div
          key={index}
          className="group flex items-start gap-3 rounded-lg border border-[var(--color-line)] bg-white p-3.5"
        >
          <p className="flex-1 whitespace-pre-wrap text-[15px] leading-relaxed text-[var(--color-ink)]">
            {draft}
          </p>
          <CopyButton
            value={draft}
            className="text-[var(--color-ink-faint)] hover:bg-black/5 hover:text-[var(--color-ink)]"
          />
        </div>
      ))}
    </div>
  );
}
