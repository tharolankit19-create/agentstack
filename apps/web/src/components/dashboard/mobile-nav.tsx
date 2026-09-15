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

export function MobileNav({ email, plan }: { email: string; plan: PlanTier }) {
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
      <div className="flex items-center justify-between border-b border-line bg-bg/95 px-4 py-3 backdrop-blur-xl">
        <Link href="/dashboard" onClick={() => setOpen(false)}>
          <LogoLockup />
        </Link>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-label={open ? "Close menu" : "Open menu"}
          className="grid size-10 place-items-center rounded-xl border border-line bg-surface text-fg transition hover:border-line-strong hover:text-fg-strong"
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {open ? (
        <div className="border-b border-line bg-bg px-3 pb-4 pt-2 shadow-[0_22px_44px_-34px_rgba(0,0,0,.35)]">
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
                    "flex min-h-11 items-center gap-2.5 rounded-xl px-3 text-sm font-medium transition-colors",
                    active
                      ? "bg-fg-strong text-bg"
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
            <div className="px-3 py-2">
              <p className="truncate text-xs font-medium text-fg">{email}</p>
              <p className="mt-0.5 text-[11px] text-faint">
                {plan === "none" ? "Pay as you go" : `${plan} plan`}
              </p>
            </div>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-fg-strong"
              >
                <LogOut className="size-4" />
                Sign out
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
