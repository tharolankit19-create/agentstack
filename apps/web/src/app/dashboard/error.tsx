"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * The dashboard's safety net.
 *
 * The dashboard used to render a blank page when the database was not set up:
 * a signed-in user with no profile row got bounced to /login, which bounced
 * them back, forever. That loop is fixed at the source, and this exists so
 * that anything else which goes wrong shows a person something they can act
 * on instead of a white rectangle.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard]", error);
  }, [error]);

  // Thrown by requireOnboardedUser when the schema is missing.
  const setupRequired =
    error.message.includes("database schema has not been created");

  return (
    <div className="surface-dark grid min-h-dvh place-items-center px-5 py-12">
      <div className="w-full max-w-lg">
        <Link href="/" className="mb-8 flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg bg-[var(--color-accent)] text-sm font-black text-white">
            A
          </span>
          <span className="font-bold text-white">AgentStack</span>
        </Link>

        {setupRequired ? (
          <>
            <h1 className="text-3xl font-extrabold text-white">
              The database is not set up yet.
            </h1>
            <p className="mt-3 leading-relaxed text-zinc-400">
              Your account is fine — the tables it needs have not been created.
              This is a one-time setup step and takes about thirty seconds.
            </p>

            <ol className="mt-6 space-y-3 text-[15px] text-zinc-300">
              <li className="flex gap-3">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-white/10 text-xs font-bold">
                  1
                </span>
                Open your Supabase project → <b>SQL Editor</b> → New query.
              </li>
              <li className="flex gap-3">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-white/10 text-xs font-bold">
                  2
                </span>
                Paste the whole of{" "}
                <code className="rounded bg-white/10 px-1.5 py-0.5 text-sm">
                  supabase/schema.sql
                </code>{" "}
                from the repo and hit Run.
              </li>
              <li className="flex gap-3">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-white/10 text-xs font-bold">
                  3
                </span>
                Come back here and reload.
              </li>
            </ol>

            <p className="mt-6 text-sm text-zinc-500">
              <code className="text-zinc-400">/api/health</code> will tell you
              when it has worked.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-3xl font-extrabold text-white">
              Something broke on our side.
            </h1>
            <p className="mt-3 leading-relaxed text-zinc-400">
              {error.message || "An unexpected error occurred."}
            </p>
            {error.digest ? (
              <p className="mt-2 text-xs text-zinc-600">Reference: {error.digest}</p>
            ) : null}
          </>
        )}

        <div className="mt-8 flex flex-wrap gap-3">
          <Button onClick={reset}>Try again</Button>
          <Link href="/">
            <Button variant="darkOutline">Back to the homepage</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
