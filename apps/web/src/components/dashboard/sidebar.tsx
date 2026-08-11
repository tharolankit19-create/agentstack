"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, LayoutGrid, LogOut, Rocket, Wand2 } from "lucide-react";
import { getTemplate } from "@/lib/templates";
import { displayName } from "@/lib/army";
import { AgentAvatar } from "@/components/ui/agent-avatar";
import { LogoLockup } from "@/components/ui/logo";
import { cn } from "@/lib/utils";
import type { Agent, PlanTier } from "@/lib/supabase/types";

type SidebarAgent = Pick<Agent, "id" | "name" | "template_id" | "status" | "paused">;

export function Sidebar({
  agents,
  email,
  plan,
  quota,
}: {
  agents: SidebarAgent[];
  email: string;
  plan: PlanTier;
  quota: number;
}) {
  const pathname = usePathname();

  // Deployed and not paused is the only thing that counts as running: a
  // configured agent has produced nothing, and a paused one has stopped.
  const running = agents.filter(
    (agent) => agent.status === "deployed" && !agent.paused,
  ).length;

  // Live ones to the top. The list is ordered by creation date otherwise,
  // which buries the agents actually doing work under the ones that stalled.
  const ordered = [...agents].sort((a, b) => {
    const live = (agent: SidebarAgent) =>
      agent.status === "deployed" && !agent.paused ? 0 : 1;
    return live(a) - live(b);
  });

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-line px-4 py-6 lg:flex">
      <Link href="/" className="mb-8 block px-2">
        <LogoLockup />
      </Link>

      <nav className="space-y-1">
        <NavLink
          href="/dashboard"
          active={pathname === "/dashboard"}
          icon={<LayoutGrid className="size-4" />}
        >
          Your army
        </NavLink>
        <NavLink
          href="/dashboard/deploy"
          active={pathname.startsWith("/dashboard/deploy")}
          icon={<Rocket className="size-4" />}
        >
          Deployments
        </NavLink>
        <NavLink
          href="/dashboard/usage"
          active={pathname.startsWith("/dashboard/usage")}
          icon={<BarChart3 className="size-4" />}
        >
          Usage
        </NavLink>
        {plan === "pro" || plan === "unlimited" ? (
          <NavLink
            href="/dashboard/custom"
            active={pathname.startsWith("/dashboard/custom")}
            icon={<Wand2 className="size-4" />}
          >
            Build from a tool
          </NavLink>
        ) : null}
      </nav>

      {agents.length > 0 ? (
        <div className="mt-8">
          <p className="flex items-center justify-between px-3 text-xs font-bold uppercase tracking-wider text-faint">
            Your agents
            {/* The number that answers "is anything actually working right
                now" without opening a page. Green only when it is true. */}
            <span className={running > 0 ? "text-live" : "text-faint"}>
              {running} live
            </span>
          </p>
          <div className="mt-2 space-y-0.5">
            {ordered.map((agent) => {
              const name = displayName(
                agent.template_id,
                agent.name,
                getTemplate(agent.template_id)?.name,
              );
              return (
                <Link
                  key={agent.id}
                  href={`/dashboard/agents/${agent.id}`}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                    pathname.startsWith(`/dashboard/agents/${agent.id}`)
                      ? "bg-surface-3 font-semibold text-fg-strong"
                      : "text-muted hover:bg-surface-2 hover:text-fg",
                  )}
                >
                  <AgentAvatar
                    name={name}
                    seed={agent.template_id}
                    size={20}
                    commander={agent.template_id === "head-agent"}
                  />
                  <span className="min-w-0 flex-1 truncate">{name}</span>
                  <StatusDot status={agent.status} paused={agent.paused} />
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="mt-auto space-y-3 pt-8">
        <div className="rounded-xl border border-line p-3">
          <p className="truncate text-xs text-muted">{email}</p>
          <p className="mt-1 text-sm font-semibold capitalize text-fg">
            {plan === "none" ? "No plan" : `${plan} plan`}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {agents.length} of {quota} agents used
          </p>
        </div>

        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <LogOut className="size-4" />
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}

function NavLink({
  href,
  active,
  icon,
  children,
}: {
  href: string;
  active: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
        active
          ? "bg-surface-3 font-semibold text-fg-strong"
          : "text-muted hover:bg-surface-2 hover:text-fg",
      )}
    >
      {icon}
      {children}
    </Link>
  );
}

function StatusDot({ status, paused }: { status: string; paused: boolean }) {
  const tone =
    paused || status === "error"
      ? status === "error"
        ? "bg-danger"
        : "bg-money"
      : status === "deployed"
        ? "bg-live"
        : status === "deploying"
          ? "bg-accent animate-pulse"
          : "bg-surface-3";

  return (
    <span
      className={cn("size-1.5 shrink-0 rounded-full", tone)}
      aria-label={paused ? "paused" : status}
    />
  );
}
