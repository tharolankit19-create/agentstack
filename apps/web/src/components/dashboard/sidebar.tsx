"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Clock3, Coins, LayoutDashboard, ListChecks, LogOut, MessageCircle, Plug, Settings, SlidersHorizontal, Users } from "lucide-react";
import { LogoLockup } from "@/components/ui/logo";
import { cn } from "@/lib/utils";
import type { Agent, PlanTier } from "@/lib/supabase/types";

type SidebarAgent = Pick<Agent, "id" | "name" | "template_id" | "status" | "paused">;

export function Sidebar({
  agents,
  email,
  plan,
  balance,
}: {
  agents: SidebarAgent[];
  email: string;
  plan: PlanTier;
  balance: number;
}) {
  const pathname = usePathname();
  const real = agents.filter((agent) =>
    agent.template_id === "head-agent" || ["deployed", "deploying", "error"].includes(agent.status),
  );

  return (
    <aside className="hidden h-dvh w-[238px] shrink-0 lg:sticky lg:top-0 lg:flex lg:flex-col lg:self-start lg:px-3 lg:py-3">
      <div className="flex min-h-0 flex-1 flex-col rounded-[24px] border border-line bg-surface/88 p-3 shadow-[0_24px_70px_-42px_rgba(16,20,32,.45)] backdrop-blur-2xl">
        <Link href="/" className="mb-5 block rounded-xl px-2 py-2"><LogoLockup /></Link>

        <nav className="space-y-1">
          <NavLink href="/dashboard" active={pathname === "/dashboard"} icon={<LayoutDashboard className="size-4" />}>Dashboard</NavLink>
          <NavLink href="/dashboard/missions" active={pathname.startsWith("/dashboard/missions")} icon={<ListChecks className="size-4" />}>Mission Control</NavLink>
          <NavLink href="/dashboard/agents" active={pathname.startsWith("/dashboard/agents")} icon={<Users className="size-4" />}>Agents</NavLink>
          <NavLink href="/dashboard/room" active={pathname.startsWith("/dashboard/room")} icon={<MessageCircle className="size-4" />}>Room</NavLink>
          <NavLink href="/dashboard/scheduled" active={pathname.startsWith("/dashboard/scheduled")} icon={<Clock3 className="size-4" />}>Scheduled work</NavLink>
        </nav>

        <div className="mt-5 border-t border-line pt-4">
          <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[.16em] text-faint">Workspace</p>
          <NavLink href="/dashboard/connectors" active={pathname.startsWith("/dashboard/connectors")} icon={<Plug className="size-4" />}>Connectors</NavLink>
          <NavLink href="/dashboard/usage" active={pathname.startsWith("/dashboard/usage")} icon={<Coins className="size-4" />}>Billing & credits</NavLink>
          <NavLink href="/dashboard/settings" active={pathname.startsWith("/dashboard/settings")} icon={<Settings className="size-4" />}>Settings</NavLink>
        </div>

        <div className="mt-auto space-y-2 pt-5">
          <Link href="/dashboard/usage" className="block rounded-2xl border border-[#4f6bff]/18 bg-[#4f6bff]/[.07] p-3 transition hover:bg-[#4f6bff]/[.11]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#4f6bff]">Credits</p>
                <p className="mt-1 text-lg font-extrabold text-fg-strong">{balance.toLocaleString()}</p>
              </div>
              <span className="rounded-xl bg-fg-strong px-3 py-2 text-xs font-bold text-bg">Add</span>
            </div>
          </Link>

          <div className="flex items-center justify-between gap-2 rounded-xl px-2 py-2 text-xs text-muted">
            <div className="min-w-0">
              <p className="truncate">{email}</p>
              <p className="mt-0.5 text-faint">{plan === "none" ? "Pay as you go" : `${plan} · ${real.length} agents`}</p>
            </div>
            <Link href="/dashboard/settings" aria-label="Settings" className="grid size-8 shrink-0 place-items-center rounded-lg hover:bg-surface-2"><SlidersHorizontal className="size-4" /></Link>
          </div>

          <form action="/auth/signout" method="post">
            <button type="submit" className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted transition hover:bg-surface-2 hover:text-fg"><LogOut className="size-4" />Sign out</button>
          </form>
        </div>
      </div>
    </aside>
  );
}

function NavLink({ href, active, icon, children }: { href: string; active: boolean; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link href={href} className={cn("flex h-10 items-center gap-2.5 rounded-xl px-3 text-[13px] font-medium transition", active ? "bg-fg-strong text-bg shadow-sm" : "text-muted hover:bg-surface-2 hover:text-fg-strong")}>
      {icon}{children}
    </Link>
  );
}
