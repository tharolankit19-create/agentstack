"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, BookOpen, LayoutGrid, LogOut, Plug, Rocket, Settings, Users, Wand2 } from "lucide-react";
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
}: {
  agents: SidebarAgent[];
  email: string;
  plan: PlanTier;
}) {
  const pathname = usePathname();

  // What actually counts as an agent the founder has.
  //
  // The setup wizard creates a row for every squad member at once, as drafts —
  // so the raw list is always fourteen, even for a founder who has only set up
  // their head agent. Showing all fourteen is exactly the "you're listing
  // agents we don't have" confusion. So the sidebar shows the head agent (which
  // runs on the platform and never carries a Vercel status) plus only the squad
  // agents that have actually been deployed. A draft nobody launched is not on
  // the list until it is.
  const isHead = (agent: SidebarAgent) => agent.template_id === "head-agent";
  const isDeployed = (agent: SidebarAgent) =>
    agent.status === "deployed" ||
    agent.status === "deploying" ||
    agent.status === "error";

  const real = agents.filter((agent) => isHead(agent) || isDeployed(agent));

  // Deployed and not paused is the only thing that counts as running: a
  // configured agent has produced nothing, and a paused one has stopped.
  const running = real.filter(
    (agent) => agent.status === "deployed" && !agent.paused,
  ).length;

  // Head first, then live ones, then the rest. The head agent is the one the
  // founder talks to, so it belongs at the top no matter its status.
  const ordered = [...real].sort((a, b) => {
    const rank = (agent: SidebarAgent) =>
      isHead(agent) ? 0 : agent.status === "deployed" && !agent.paused ? 1 : 2;
    return rank(a) - rank(b);
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
          Dashboard
        </NavLink>
        <NavLink
          href="/dashboard/agents"
          active={pathname === "/dashboard/agents"}
          icon={<Users className="size-4" />}
        >
          Agents
        </NavLink>
        <NavLink
          href="/dashboard/connectors"
          active={pathname.startsWith("/dashboard/connectors")}
          icon={<Plug className="size-4" />}
        >
          Connectors
        </NavLink>

        {/* Everything below the line is occasional. Deployments, team memory,
            usage and the custom builder were sitting in the primary nav with
            equal weight to Dashboard and Agents, which made a seven-item list
            where two of them are the product. They are still one click away —
            just not competing with the pages a founder opens daily. */}
        <div className="!mt-5 border-t border-line pt-4">
          <NavLink
            href="/dashboard/deploy"
            active={pathname.startsWith("/dashboard/deploy")}
            icon={<Rocket className="size-4" />}
          >
            Deployments
          </NavLink>
          <NavLink
            href="/dashboard/wiki"
            active={pathname.startsWith("/dashboard/wiki")}
            icon={<BookOpen className="size-4" />}
          >
            Team memory
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
        </div>

        <NavLink
          href="/dashboard/settings"
          active={pathname.startsWith("/dashboard/settings")}
          icon={<Settings className="size-4" />}
        >
          Settings
        </NavLink>
      </nav>

      {real.length > 0 ? (
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
            {real.length} {real.length === 1 ? "agent" : "agents"}
            {running > 0 ? `, ${running} live` : ""}
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
