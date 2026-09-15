"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Clock3,
  Coins,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  MessageCircle,
  Settings,
  Users,
  X,
} from "lucide-react";
import { LogoLockup } from "@/components/ui/logo";
import { cn } from "@/lib/utils";
import type { PlanTier } from "@/lib/supabase/types";

/**
 * Mobile navigation mirrors the desktop workspace exactly.
 *
 * Keeping a separate "mobile information architecture" made the product feel
 * like two different apps: desktop had Mission Control/Room/Scheduled work
 * while phones still showed legacy Deployments/Team memory links. The same
 * founder should see the same mental model on every screen size.
 */
export function MobileNav({
  email,
  plan,
  balance,
}: {
  email: string;
  plan: PlanTier;
  balance: number;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const links = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true },
    { href: "/dashboard/missions", label: "Mission Control", icon: ListChecks },
    { href: "/dashboard/agents", label: "Agents", icon: Users },
    { href: "/dashboard/room", label: "Room", icon: MessageCircle },
    { href: "/dashboard/scheduled", label: "Scheduled work", icon: Clock3 },
    { href: "/dashboard/usage", label: "Billing & credits", icon: Coins },
    { href: "/dashboard/settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className="lg:hidden">
      <div className="sticky top-0 z-50 flex items-center justify-between border-b border-line bg-surface/95 px-4 py-3 backdrop-blur-xl">
        <Link href="/dashboard" onClick={() => setOpen(false)}>
          <LogoLockup />
        </Link>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/usage"
            onClick={() => setOpen(false)}
            className="rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-xs font-bold text-fg-strong"
          >
            {balance.toLocaleString()} credits
          </Link>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            className="grid size-10 place-items-center rounded-xl border border-line bg-surface text-fg"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {open ? (
        <div className="fixed inset-x-0 top-[65px] z-40 border-b border-line bg-surface/98 px-3 pb-4 pt-3 shadow-[var(--shadow)] backdrop-blur-xl">
          <nav className="space-y-1">
            {links.map((link) => {
              const active = link.exact
                ? pathname === link.href
                : pathname.startsWith(link.href);
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-colors",
                    active
                      ? "bg-fg-strong font-semibold text-bg"
                      : "text-muted hover:bg-surface-2 hover:text-fg-strong",
                  )}
                >
                  <Icon className="size-4" />
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-3 border-t border-line pt-3">
            <div className="flex items-center justify-between gap-3 px-3">
              <div className="min-w-0">
                <p className="truncate text-xs text-muted">{email}</p>
                <p className="mt-0.5 text-[11px] text-faint">
                  {plan === "none" ? "Pay as you go" : `${plan} plan`}
                </p>
              </div>
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-fg-strong"
                >
                  <LogOut className="size-4" />
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
