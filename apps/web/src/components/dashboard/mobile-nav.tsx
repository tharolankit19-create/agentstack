"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, BookOpen, LayoutGrid, LogOut, Menu, Plug, Rocket, Settings, Users, Wand2, X } from "lucide-react";
import { LogoLockup } from "@/components/ui/logo";
import { cn } from "@/lib/utils";
import type { PlanTier } from "@/lib/supabase/types";

/**
 * Navigation on a phone.
 *
 * The sidebar is desktop-only, so until now a founder on a phone — which is
 * most of them, and certainly the one messaging the bot — had no way to reach
 * Settings, Usage, or Sign out at all. This is a top bar with a drawer that
 * carries the same links, shown only below the sidebar's breakpoint so the two
 * never appear at once.
 */
export function MobileNav({ email, plan }: { email: string; plan: PlanTier }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const links = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutGrid, exact: true },
    { href: "/dashboard/agents", label: "Agents", icon: Users },
    { href: "/dashboard/deploy", label: "Deployments", icon: Rocket },
    { href: "/dashboard/wiki", label: "Team memory", icon: BookOpen },
    { href: "/dashboard/connectors", label: "Connectors", icon: Plug },
    { href: "/dashboard/usage", label: "Usage", icon: BarChart3 },
    ...(plan === "pro" || plan === "unlimited"
      ? [{ href: "/dashboard/custom", label: "Build from a tool", icon: Wand2 }]
      : []),
    { href: "/dashboard/settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className="lg:hidden">
      <div className="flex items-center justify-between border-b border-line bg-bg px-5 py-3">
        <Link href="/dashboard" onClick={() => setOpen(false)}>
          <LogoLockup />
        </Link>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close menu" : "Open menu"}
          className="grid size-10 place-items-center rounded-lg border border-line text-fg"
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {open ? (
        <div className="border-b border-line bg-surface-2 px-3 py-3">
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
                    "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors",
                    active
                      ? "bg-surface-3 font-semibold text-fg-strong"
                      : "text-muted hover:bg-surface hover:text-fg",
                  )}
                >
                  <Icon className="size-4" />
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-3 border-t border-line pt-3">
            <p className="truncate px-3 text-xs text-muted">{email}</p>
            <form action="/auth/signout" method="post" className="mt-1">
              <button
                type="submit"
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-muted transition-colors hover:bg-surface hover:text-fg"
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
