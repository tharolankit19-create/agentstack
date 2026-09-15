import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { displayName, HEAD_AGENT, rosterTemplateIds } from "@/lib/army";
import { getTemplate } from "@/lib/templates";
import { cadenceLabel } from "@/lib/cadence";
import { AgentAvatar } from "@/components/ui/agent-avatar";
import {
  ScheduleBuilder,
  CancelScheduledTask,
  LocalTaskTime,
  type SchedulableAgent,
} from "@/components/dashboard/schedule-builder";
import type { Agent, ScheduledTask } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function ScheduledPage() {
  const session = await requireUser("/dashboard/scheduled");
  const admin = createAdminClient();

  const [{ data: agentRows }, { data: taskRows }] = await Promise.all([
    admin
      .from("agents")
      .select("id, template_id, name, paused, status")
      .eq("user_id", session.userId)
      .order("created_at", { ascending: true }),
    admin
      .from("scheduled_tasks")
      .select("*")
      .eq("user_id", session.userId)
      .order("run_at", { ascending: true })
      .limit(100),
  ]);

  const agents = (agentRows ?? []) as Pick<
    Agent,
    "id" | "template_id" | "name" | "paused" | "status"
  >[];
  const tasks = (taskRows ?? []) as ScheduledTask[];

  const schedulable: SchedulableAgent[] = agents
    .filter((agent) => agent.status !== "error")
    .map((agent) => {
      const template = getTemplate(agent.template_id);
      return {
        id: agent.id,
        name: displayName(agent.template_id, agent.name, template?.name),
        role:
          agent.template_id === HEAD_AGENT.id
            ? HEAD_AGENT.name
            : template?.name ?? "Specialist",
      };
    });

  const agentById = new Map(schedulable.map((agent) => [agent.id, agent]));
  const pending = tasks.filter((task) => task.status === "pending");
  const past = tasks.filter((task) => task.status !== "pending");

  const standing = agents
    .filter((agent) => agent.template_id !== HEAD_AGENT.id)
    .map((agent) => {
      const template = getTemplate(agent.template_id);
      return {
        id: agent.id,
        name: displayName(agent.template_id, agent.name, template?.name),
        templateId: agent.template_id,
        job: template?.scheduledTask ?? null,
        cadence: cadenceLabel(template?.frequency),
        paused: agent.paused,
      };
    })
    .filter((row) => row.job);

  return (
    <div className="space-y-9">
      <header>
        <h1 className="text-3xl font-extrabold tracking-[-0.02em] text-fg-strong">
          Scheduled work
        </h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted">
          Give any agent a plain-language task, choose when it starts, and decide
          whether it runs once, daily, or hourly.
        </p>
      </header>

      <ScheduleBuilder agents={schedulable} />

      <section>
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <h2 className="text-[17px] font-bold text-fg-strong">Your schedules</h2>
            <p className="mt-1 text-[14px] text-muted">
              These are the tasks you explicitly asked Kryx to run.
            </p>
          </div>
          {pending.length ? (
            <span className="text-xs font-semibold text-faint">
              {pending.length} active
            </span>
          ) : null}
        </div>

        {pending.length ? (
          <ul className="mt-4 space-y-2">
            {pending.map((task) => {
              const owner = task.agent_id ? agentById.get(task.agent_id) : null;
              const repeat =
                task.recurrence === "daily"
                  ? "Daily"
                  : task.recurrence === "hourly"
                    ? "Hourly"
                    : "Once";
              return (
                <li
                  key={task.id}
                  className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-4"
                >
                  {owner ? (
                    <AgentAvatar name={owner.name} seed={owner.templateId} size={32} />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold text-fg-strong">
                        {owner?.name ?? "Kryx"}
                      </p>
                      <span className="rounded-full border border-line bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-muted">
                        {repeat}
                      </span>
                    </div>
                    <p className="mt-1 text-[14px] leading-6 text-fg">
                      {task.instruction}
                    </p>
                    <p className="mt-1 text-[12.5px] text-muted">
                      Next run: <LocalTaskTime iso={task.run_at} />
                    </p>
                    {task.error ? (
                      <p className="mt-1 text-[12.5px] text-danger">
                        Last run: {task.error}
                      </p>
                    ) : null}
                  </div>
                  <CancelScheduledTask taskId={task.id} />
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-4 rounded-2xl border border-dashed border-line px-5 py-10 text-center text-sm text-muted">
            No founder-created schedules yet.
          </p>
        )}
      </section>

      <section>
        <h2 className="text-[17px] font-bold text-fg-strong">Built-in agent rhythms</h2>
        <p className="mt-1 text-[14px] text-muted">
          These are each specialist&apos;s default background jobs. Pause the
          specialist on its page if you want one to stop.
        </p>

        {standing.length ? (
          <ul className="mt-4 divide-y divide-line overflow-hidden rounded-2xl border border-line">
            {standing.map((row) => (
              <li key={row.id} className="flex items-start gap-3 bg-surface px-4 py-3.5">
                <AgentAvatar name={row.name} seed={row.templateId} size={30} />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-baseline gap-2 text-[15px] font-semibold text-fg-strong">
                    {row.name}
                    <span className="text-[12.5px] font-medium text-muted">{row.cadence}</span>
                    {row.paused ? (
                      <span className="text-[12px] font-semibold text-faint">paused</span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-[13.5px] leading-snug text-muted">{row.job}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 rounded-xl border border-dashed border-line px-5 py-10 text-center text-[15px] text-muted">
            No specialists yet. Start your team from the dashboard.
          </p>
        )}
      </section>

      {past.length ? (
        <section>
          <h2 className="text-[17px] font-bold text-fg-strong">History</h2>
          <ul className="mt-3 divide-y divide-line overflow-hidden rounded-2xl border border-line">
            {past.slice(-20).reverse().map((task) => (
              <li key={task.id} className="bg-surface px-4 py-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-[14.5px] font-medium text-fg">
                      {task.instruction}
                    </p>
                    {task.ran_at ? (
                      <p className="mt-1 text-xs text-faint">
                        Ran <LocalTaskTime iso={task.ran_at} />
                      </p>
                    ) : null}
                  </div>
                  <span
                    className={
                      task.status === "done"
                        ? "shrink-0 text-[12.5px] font-semibold text-live"
                        : task.status === "cancelled"
                          ? "shrink-0 text-[12.5px] font-semibold text-muted"
                          : "shrink-0 text-[12.5px] font-semibold text-danger"
                    }
                  >
                    {task.status}
                  </span>
                </div>
                {task.error ? (
                  <p className="mt-1 text-[13px] text-muted">{task.error}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
