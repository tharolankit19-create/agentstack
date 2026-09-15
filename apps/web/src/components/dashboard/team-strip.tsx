import Link from "next/link";
import { AgentAvatar } from "@/components/ui/agent-avatar";
import { displayName, memberFor } from "@/lib/army";
import { getTemplate } from "@/lib/templates";
import { cn } from "@/lib/utils";
import type { Agent } from "@/lib/supabase/types";

export function TeamStrip({ agents }: { agents: Agent[] }) {
  if (!agents.length) return null;

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="flex items-center justify-between gap-4 border-b border-line px-4 py-3.5 sm:px-5">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[.12em] text-faint">
            Your team
          </p>
          <p className="mt-0.5 text-sm font-semibold text-fg-strong">
            Faces stay attached to the work.
          </p>
        </div>
        <Link
          href="/dashboard/agents"
          className="shrink-0 text-xs font-semibold text-muted hover:text-fg-strong"
        >
          Open all agents →
        </Link>
      </div>

      <div className="overflow-x-auto">
        <div className="flex min-w-max divide-x divide-line">
          {agents.map((agent) => {
            const template = getTemplate(agent.template_id);
            const name = displayName(agent.template_id, agent.name, template?.name);
            const role = memberFor(agent.template_id)?.role ?? template?.name ?? "Agent";
            const live = agent.status === "deployed" && !agent.paused;
            const errored = agent.status === "error";

            return (
              <Link
                key={agent.id}
                href={`/dashboard/agents/${agent.id}`}
                className="group flex w-[168px] items-center gap-3 px-4 py-4 transition hover:bg-surface-2"
              >
                <div className="relative shrink-0">
                  <AgentAvatar
                    name={name}
                    seed={agent.template_id}
                    size={42}
                    commander={agent.template_id === "head-agent"}
                    animated={live}
                  />
                  <span
                    className={cn(
                      "absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-surface",
                      errored
                        ? "bg-danger"
                        : live
                          ? "bg-live"
                          : "bg-surface-3",
                    )}
                    aria-hidden
                  />
                </div>

                <div className="min-w-0">
                  <p className="truncate text-[13px] font-extrabold text-fg-strong">
                    {name}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-[10.5px] leading-4 text-faint">
                    {role}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
