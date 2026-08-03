"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, LogOut, Rocket, Wand2 } from "lucide-react";
import { getTemplate } from "@/lib/templates";
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

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-line px-4 py-6 lg:flex">
      <Link href="/" className="mb-8 flex items-center gap-2.5 px-2">
        <span className="grid size-8 place-items-center rounded-lg bg-accent text-sm font-black text-fg-strong">
          A
        </span>
        <span className="font-bold text-fg-strong">AgentStack</span>
      </Link>

      <nav className="space-y-1">
        <NavLink
          href="/dashboard"
          active={pathname === "/dashboard"}
          icon={<LayoutGrid className="size-4" />}
        >
          All agents
        </NavLink>
        <NavLink
          href="/dashboard/deploy"
          active={pathname.startsWith("/dashboard/deploy")}
          icon={<Rocket className="size-4" />}
        >
          Deployments
        </NavLink>
        {plan === "pro" ? (
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
          <p className="px-3 text-xs font-bold uppercase tracking-wider text-faint">
            Your agents
          </p>
          <div className="mt-2 space-y-0.5">
            {agents.map((agent) => (
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
                <span aria-hidden>{getTemplate(agent.template_id)?.icon ?? "🧩"}</span>
                <span className="min-w-0 flex-1 truncate">{agent.name}</span>
                <StatusDot status={agent.status} paused={agent.paused} />
              </Link>
            ))}
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
