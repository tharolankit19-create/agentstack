import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { HEAD_AGENT, SQUADS, displayName, memberFor } from "@/lib/army";
import { getTemplate } from "@/lib/templates";
import { AgentAvatar } from "@/components/ui/agent-avatar";
import { LaunchAll } from "@/components/dashboard/launch-all";
import { cn } from "@/lib/utils";
import type { Agent, AgentStats } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

/**
 * Your agents — the org chart, as a page.
 *
 * The dashboard answers "what happened today". This answers "who works for me,
 * and what is each of them doing". They were tangled together before: agents
 * appeared in a sidebar list, in a squads grid, and again under Deployments,
 * each showing a different subset with different words for the same states —
 * which is why nothing felt like it had a place.
 *
 * So there is one page, and it reads top to bottom the way the army is actually
 * shaped: the head agent first and visibly in charge, then each squad beneath
 * it. Every agent shows one thing — what it is doing right now — and clicking
 * it opens that agent. Nothing here needs a manual per-agent deploy: the button
 * at the top turns the whole army on.
 */
export default async function AgentsPage() {
  // Called for the redirect, not the value: this page reads through RLS.
  await requireUser("/dashboard/agents");
  const supabase = await createClient();

  const [{ data: agents }, { data: stats }] = await Promise.all([
    supabase.from("agents").select("*").order("created_at", { ascending: true }),
    supabase.from("agent_stats").select("*"),
  ]);

  const owned = (agents ?? []) as Agent[];
  const statsById = new Map(
    ((stats ?? []) as AgentStats[]).map((row) => [row.agent_id, row]),
  );
  const byTemplate = new Map(owned.map((a) => [a.template_id, a]));

  const head = byTemplate.get(HEAD_AGENT.id);
  const notLive = owned.filter(
    (a) => a.status !== "deployed" || a.paused,
  ).length;

  return (
    <div className="max-w-4xl space-y-8">
      <header>
        <h1 className="text-3xl font-extrabold text-fg-strong">Your agents</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">
          {HEAD_AGENT.defaultName} runs the team. Every agent below reports to
          them and works on its own schedule — you only read the results.
        </p>
      </header>

      {/* One button turns everything on. Nobody should deploy fourteen agents
          one at a time, and nobody should have to know they were meant to. */}
      {owned.length > 0 && notLive > 0 ? <LaunchAll pending={notLive} /> : null}

      {/* ── The commander ─────────────────────────────────────────────────── */}
      {head ? (
        <section>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-faint">
            Runs the team
          </p>
          <Link
            href={`/dashboard/agents/${head.id}`}
            className="flex flex-wrap items-center gap-4 rounded-2xl border border-line-strong bg-surface-2 p-5 shadow-[var(--shadow)] transition-colors hover:border-accent-line"
          >
            <AgentAvatar
              name={head.name}
              seed={HEAD_AGENT.id}
              size={52}
              commander
              animated
            />
            <div className="min-w-0 flex-1">
              <p className="text-lg font-extrabold text-fg-strong">
                {displayName(head.template_id, head.name, HEAD_AGENT.name)}
              </p>
              <p className="text-sm text-muted">{HEAD_AGENT.mission}</p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-3.5 py-2 text-sm font-bold text-accent-fg">
              <MessageSquare className="size-4" />
              Chat
            </span>
          </Link>
        </section>
      ) : null}

      {/* ── The squads ────────────────────────────────────────────────────── */}
      {SQUADS.map((squad) => {
        const members = squad.pipeline
          .map((sub) => (sub.templateId ? byTemplate.get(sub.templateId) : undefined))
          .filter((a): a is Agent => Boolean(a));

        if (members.length === 0) return null;

        return (
          <section key={squad.id}>
            <div className="mb-2 flex items-baseline gap-2">
              <span aria-hidden>{squad.icon}</span>
              <h2 className="text-sm font-bold text-fg-strong">{squad.name}</h2>
              <span className="text-xs text-muted">{squad.mission}</span>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {members.map((agent) => (
                <AgentRow
                  key={agent.id}
                  agent={agent}
                  produced={statsById.get(agent.id)?.generations_this_month ?? 0}
                />
              ))}
            </div>
          </section>
        );
      })}

      {owned.length === 0 ? (
        <p className="rounded-2xl border border-line bg-surface-2 p-5 text-sm text-muted">
          No agents yet. Set up your head agent on the dashboard and the whole
          team is created with it.
        </p>
      ) : null}
    </div>
  );
}

/** One agent, and the single most useful fact about it: what it's doing. */
function AgentRow({ agent, produced }: { agent: Agent; produced: number }) {
  const template = getTemplate(agent.template_id);
  const name = displayName(agent.template_id, agent.name, template?.name);
  const role = memberFor(agent.template_id)?.role ?? template?.name ?? "Agent";

  const live = agent.status === "deployed" && !agent.paused;
  const state = live
    ? produced > 0
      ? { text: `${produced} this month`, tone: "text-live", dot: "bg-live" }
      : { text: "running", tone: "text-live", dot: "bg-live" }
    : agent.status === "error"
      ? { text: "needs a look", tone: "text-danger", dot: "bg-danger" }
      : agent.status === "deploying"
        ? { text: "starting up…", tone: "text-accent", dot: "bg-accent" }
        : agent.paused
          ? { text: "stopped", tone: "text-money", dot: "bg-money" }
          : { text: "not started yet", tone: "text-faint", dot: "bg-surface-3" };

  return (
    <Link
      href={`/dashboard/agents/${agent.id}`}
      className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3 transition-all hover:-translate-y-0.5 hover:border-line-strong hover:shadow-[var(--shadow)]"
    >
      <AgentAvatar name={name} seed={agent.template_id} size={36} animated={live} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-fg-strong">{name}</p>
        <p className="truncate text-[11px] font-medium uppercase tracking-wide text-faint">
          {role}
        </p>
      </div>
      <span className={cn("flex shrink-0 items-center gap-1.5 text-[11px] font-semibold", state.tone)}>
        <span className={cn("size-1.5 rounded-full", state.dot)} aria-hidden />
        {state.text}
      </span>
    </Link>
  );
}
