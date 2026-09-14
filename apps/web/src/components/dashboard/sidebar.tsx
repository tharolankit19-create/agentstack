"use client";

import Link from "next/link";
import { NavigationFeedback } from "./navigation-feedback";
import { usePathname } from "next/navigation";
import { BarChart3, BookOpen, Clock, Coins, LayoutGrid, LayoutList, LogOut, MessagesSquare, Plug, Rocket, Settings, Target, Users, Wand2 } from "lucide-react";
import { getTemplate } from "@/lib/templates";
import { displayName } from "@/lib/army";
import { AgentAvatar } from "@/components/ui/agent-avatar";
import { LogoLockup } from "@/components/ui/logo";
import { cn } from "@/lib/utils";
import type { Agent, PlanTier } from "@/lib/supabase/types";

type SidebarAgent = Pick<Agent, "id" | "name" | "template_id" | "status" | "paused">;

export function Sidebar({ agents, email, plan, balance }: { agents: SidebarAgent[]; email: string; plan: PlanTier; balance: number }) {
  const pathname = usePathname();
  const isHead = (agent: SidebarAgent) => agent.template_id === "head-agent";
  const isDeployed = (agent: SidebarAgent) => agent.status === "deployed" || agent.status === "deploying" || agent.status === "error";
  const real = agents.filter((agent) => isHead(agent) || isDeployed(agent));
  const running = real.filter((agent) => agent.status === "deployed" && !agent.paused).length;
  const ordered = [...real].sort((a, b) => {
    const rank = (agent: SidebarAgent) => isHead(agent) ? 0 : agent.status === "deployed" && !agent.paused ? 1 : 2;
    return rank(a) - rank(b);
  });

  return (
    <aside className="kryx-sidebar hidden w-64 shrink-0 flex-col border-r border-line px-4 py-6 lg:flex">
      <Link href="/" className="mb-8 block px-2"><LogoLockup /></Link>

      <nav className="space-y-1">
        <NavLink href="/dashboard" active={pathname === "/dashboard"} icon={<LayoutGrid className="size-4" />}>Dashboard</NavLink>
        <NavLink href="/dashboard/missions" active={pathname.startsWith("/dashboard/missions")} icon={<LayoutList className="size-4" />}>Mission Control</NavLink>
        <NavLink href="/dashboard/room" active={pathname.startsWith("/dashboard/room")} icon={<MessagesSquare className="size-4" />}>The room</NavLink>
        <NavLink href="/dashboard/leads" active={pathname.startsWith("/dashboard/leads")} icon={<Target className="size-4" />}>Leads</NavLink>
        <NavLink href="/dashboard/agents" active={pathname === "/dashboard/agents"} icon={<Users className="size-4" />}>Agents</NavLink>
        <NavLink href="/dashboard/scheduled" active={pathname.startsWith("/dashboard/scheduled")} icon={<Clock className="size-4" />}>Scheduled</NavLink>
        <NavLink href="/dashboard/connectors" active={pathname.startsWith("/dashboard/connectors")} icon={<Plug className="size-4" />}>Connectors</NavLink>

        <div className="!mt-5 border-t border-line pt-4">
          <NavLink href="/dashboard/deploy" active={pathname.startsWith("/dashboard/deploy")} icon={<Rocket className="size-4" />}>Deployments</NavLink>
          <NavLink href="/dashboard/wiki" active={pathname.startsWith("/dashboard/wiki")} icon={<BookOpen className="size-4" />}>Team memory</NavLink>
          <NavLink href="/dashboard/usage" active={pathname.startsWith("/dashboard/usage")} icon={<BarChart3 className="size-4" />}>Usage</NavLink>
          {plan === "pro" || plan === "unlimited" ? <NavLink href="/dashboard/custom" active={pathname.startsWith("/dashboard/custom")} icon={<Wand2 className="size-4" />}>Build from a tool</NavLink> : null}
        </div>
        <NavLink href="/dashboard/settings" active={pathname.startsWith("/dashboard/settings")} icon={<Settings className="size-4" />}>Settings</NavLink>
      </nav>

      {real.length > 0 ? (
        <div className="mt-8">
          <p className="flex items-center justify-between px-3 text-xs font-bold uppercase tracking-wider text-faint">Your agents<span className={running > 0 ? "text-live" : "text-faint"}>{running} live</span></p>
          <div className="mt-2 space-y-0.5">
            {ordered.map((agent) => {
              const name = displayName(agent.template_id, agent.name, getTemplate(agent.template_id)?.name);
              return (
                <Link key={agent.id} href={`/dashboard/agents/${agent.id}`} className={cn("flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors", pathname.startsWith(`/dashboard/agents/${agent.id}`) ? "bg-surface-3 font-semibold text-fg-strong" : "text-muted hover:bg-surface-2 hover:text-fg")}>
                  <AgentAvatar name={name} seed={agent.template_id} size={20} commander={agent.template_id === "head-agent"} />
                  <span className="min-w-0 flex-1 truncate">{name}</span>
                  <StatusDot status={agent.status} paused={agent.paused} />
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="mt-auto space-y-3 pt-8">
        <Link href="/dashboard/usage" className="group block rounded-2xl border border-[#4f6bff]/20 bg-[#4f6bff]/8 p-3.5 transition hover:border-[#4f6bff]/35 hover:bg-[#4f6bff]/12">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.12em] text-[#4f6bff]"><Coins className="size-4" />Credits</div>
          <div className="mt-2 flex items-end justify-between gap-3"><div><p className="text-xl font-extrabold text-fg-strong">{balance.toLocaleString()}</p><p className="text-[11px] text-muted">≈ ${(balance / 100).toFixed(2)} work balance</p></div><span className="rounded-lg bg-[#101114] px-3 py-2 text-xs font-bold text-white dark:bg-white dark:text-black">Add</span></div>
        </Link>

        <div className="rounded-xl border border-line p-3">
          <p className="truncate text-xs text-muted">{email}</p>
          <p className="mt-1 text-sm font-semibold text-fg">{plan === "none" ? "Pay as you go" : `${plan} plan`}</p>
          <p className="mt-0.5 text-xs text-muted">{real.length} {real.length === 1 ? "agent" : "agents"}{running > 0 ? `, ${running} live` : ""}</p>
        </div>

        <form action="/auth/signout" method="post"><button type="submit" className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-fg"><LogOut className="size-4" />Sign out</button></form>
      </div>
    </aside>
  );
}

function NavLink({ href, active, icon, children }: { href: string; active: boolean; icon: React.ReactNode; children: React.ReactNode }) {
  return <Link href={href} className={cn("flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors", active ? "bg-surface-3 font-semibold text-fg-strong" : "text-muted hover:bg-surface-2 hover:text-fg")}>{icon}{children}<NavigationFeedback /></Link>;
}

function StatusDot({ status, paused }: { status: string; paused: boolean }) {
  const tone = paused || status === "error" ? status === "error" ? "bg-danger" : "bg-money" : status === "deployed" ? "bg-live" : status === "deploying" ? "bg-accent animate-pulse" : "bg-surface-3";
  return <span className={cn("size-1.5 shrink-0 rounded-full", tone)} aria-label={paused ? "paused" : status} />;
}

