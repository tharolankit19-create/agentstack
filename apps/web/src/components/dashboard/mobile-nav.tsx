"use client";
import { useState } from "react";
import Link from "next/link";
import { OperatorNav } from "@/components/operator/navigation";
import type { PlanTier } from "@/lib/supabase/types";
export function MobileNav({
  email,
  balance,
}: {
  email: string;
  plan: PlanTier;
  balance: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <header className="lg:hidden border-b border-line p-4">
      <div className="flex items-center justify-between">
        <Link href="/dashboard" className="font-semibold">
          Kryx
        </Link>
        <button
          aria-expanded={open}
          aria-label="Workspace navigation"
          onClick={() => setOpen(!open)}
        >
          {open ? "Close" : "Menu"}
        </button>
      </div>
      {open && (
        <div className="mt-4">
          <OperatorNav />
          <p className="mt-4 text-xs text-muted">
            {email} · {balance} credits
          </p>
          <form method="post" action="/auth/signout">
            <button className="mt-3 text-sm">Sign out</button>
          </form>
        </div>
      )}
    </header>
  );
}
