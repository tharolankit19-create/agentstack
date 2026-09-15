"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Clock3, Coins, LayoutDashboard, ListChecks, LogOut, MessageCircle, Settings, SlidersHorizontal } from "lucide-react";
import { LogoLockup } from "@/components/ui/logo";
import { AgentAvatar } from "@/components/ui/agent-avatar";
import { cn } from "@/lib/utils";
import type { PlanTier } from "@/lib/supabase/types";

const CORE_ROUTES = ["/dashboard", "/dashboard/missions", "/dashboard/agents", "/dashboard/room", "/dashboard/scheduled", "/dashboard/usage", "/dashboard/settings"];

export function Sidebar({ email, plan, balance }: { email: string; plan: PlanTier; balance: number }) {
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => { const id = window.setTimeout(() => CORE_ROUTES.forEach((route) => router.prefetch(route)), 250); return () => window.clearTimeout(id); }, [router]);

  return (
    <aside className="hidden h-dvh w-[238px] shrink-0 lg:sticky lg:top-0 lg:flex lg:flex-col lg:self-start lg:px-3 lg:py-3">
      <div className="flex min-h-0 flex-1 flex-col rounded-[24px] border border-line bg-surface/92 p-3 shadow-[0_24px_70px_-42px_rgba(16,20,32,.45)] backdrop-blur-2xl">
        <Link href="/" className="mb-5 block rounded-xl px-2 py-2"><LogoLockup /></Link>
        <nav className="space-y-1">
          <NavLink href="/dashboard" active={pathname === "/dashboard"} icon={<LayoutDashboard className="size-4" />}>Dashboard</NavLink>
          <NavLink href="/dashboard/missions" active={pathname.startsWith("/dashboard/missions")} icon={<ListChecks className="size-4" />}>Mission Control</NavLink>
          <NavLink href="/dashboard/agents" active={pathname.startsWith("/dashboard/agents")} icon={<AgentStackIcon />}>Agents</NavLink>
          <NavLink href="/dashboard/room" active={pathname.startsWith("/dashboard/room")} icon={<MessageCircle className="size-4" />}>Room</NavLink>
          <NavLink href="/dashboard/scheduled" active={pathname.startsWith("/dashboard/scheduled")} icon={<Clock3 className="size-4" />}>Scheduled work</NavLink>
        </nav>
        <div className="mt-5 border-t border-line pt-4">
          <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[.16em] text-faint">Workspace</p>
          <NavLink href="/dashboard/usage" active={pathname.startsWith("/dashboard/usage")} icon={<Coins className="size-4" />}>Billing & credits</NavLink>
          <NavLink href="/dashboard/settings" active={pathname.startsWith("/dashboard/settings")} icon={<Settings className="size-4" />}>Settings</NavLink>
        </div>
        <div className="mt-auto space-y-2 pt-5">
          <Link href="/dashboard/usage" className="block rounded-2xl border border-accent-line bg-accent-wash p-3 transition-all hover:-translate-y-0.5 hover:border-accent active:translate-y-0">
            <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-accent">Credits</p><p className="mt-1 text-lg font-extrabold text-fg-strong">{balance.toLocaleString()}</p><p className="text-[10px] text-faint">available for specialist work</p></div><span className="rounded-xl bg-fg-strong px-3 py-2 text-xs font-bold text-bg">Add</span></div>
          </Link>
          <div className="flex items-center justify-between gap-2 rounded-xl px-2 py-2 text-xs text-muted"><div className="min-w-0"><p className="truncate">{email}</p><p className="mt-0.5 text-faint">{plan === "none" ? "Pay as you go" : `${plan} plan`}</p></div><Link href="/dashboard/settings" aria-label="Settings" className="grid size-8 shrink-0 place-items-center rounded-lg hover:bg-surface-2"><SlidersHorizontal className="size-4" /></Link></div>
          <form action="/auth/signout" method="post"><button type="submit" className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted transition hover:bg-surface-2 hover:text-fg"><LogOut className="size-4" />Sign out</button></form>
        </div>
      </div>
    </aside>
  );
}

function NavLink({ href, active, icon, children }: { href: string; active: boolean; icon: React.ReactNode; children: React.ReactNode }) {
  return <Link href={href} prefetch className={cn("flex h-10 items-center gap-2.5 rounded-xl px-3 text-[13px] font-medium transition-all duration-150 active:scale-[.985]", active ? "bg-fg-strong text-bg shadow-sm" : "text-muted hover:bg-surface-2 hover:text-fg-strong")}>{icon}{children}</Link>;
}


function AgentStackIcon() {
  return (
    <span className="relative inline-flex h-5 w-7 shrink-0 items-center">
      <AgentAvatar
        name="Kryx"
        seed="head-agent"
        commander
        size={18}
        className="absolute left-0 ring-1 ring-surface"
      />
      <AgentAvatar
        name="Ida"
        seed="research-agent"
        size={18}
        className="absolute left-[9px] ring-1 ring-surface"
      />
    </span>
  );
}
