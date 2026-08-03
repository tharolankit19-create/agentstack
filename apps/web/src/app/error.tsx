"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/** Catches anything outside the dashboard. Never a blank page. */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app]", error);
  }, [error]);

  // Thrown by the auth guards when the schema is missing. It has a specific
  // fix, so it gets a specific message rather than "something went wrong".
  const setupRequired = error.message.includes(
    "database schema has not been created",
  );

  return (
    <main className="grid min-h-dvh place-items-center px-5">
      <div className="max-w-md text-center">
        <p className="text-sm font-bold uppercase tracking-wider text-accent">
          {setupRequired ? "Setup" : "Error"}
        </p>
        <h1 className="mt-3 text-3xl font-extrabold">
          {setupRequired
            ? "The database is not set up yet."
            : "That page did not load."}
        </h1>
        <p className="mt-3 text-[17px] leading-relaxed text-muted">
          {setupRequired
            ? "Paste supabase/schema.sql into your Supabase SQL editor and run it, then reload. It is a one-time step."
            : error.message || "Something went wrong on our side."}
        </p>
        {error.digest ? (
          <p className="mt-2 text-xs text-faint">
            Reference: {error.digest}
          </p>
        ) : null}

        <div className="mt-8 flex justify-center gap-3">
          <Button onClick={reset}>Try again</Button>
          <Link href="/">
            <Button variant="outline">Homepage</Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
