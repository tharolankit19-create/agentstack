import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { displayName, HEAD_AGENT } from "@/lib/army";
import { getTemplate } from "@/lib/templates";
import { cadenceLabel } from "@/lib/cadence";
import { AgentAvatar } from "@/components/ui/agent-avatar";
import type { Agent, ScheduledTask } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

/**
 * Everything that runs without being asked.
 *
 * Two different kinds of schedule, deliberately on one page. The standing ones
 * are each agent's own cadence — the SEO audit weekly, the review check every
 * six hours — which the founder never set and mostly should not have to think
 * about. The one-off ones are things they asked for in conversation: "at 5pm
 * write the launch post".
 *
 * That second list is the point of the page. The founder already creates those
 * by typing a sentence at their head agent, and until now there was nowhere to
 * see what they had asked for, whether it had run, or what it produced. A
 * promise you cannot audit is one you stop trusting the third time you cannot
 * remember whether you made it.
 */
export default async function ScheduledPage() {
  const session = await requireUser("/dashboard/scheduled");
  const admin = createAdminClient();

  const [{ data: agentRows }, { data: taskRows }] = await Promise.all([
    admin
      .from("agents")
      .select("id, template_id, name, paused")
      .eq("user_id", session.userId)
      .order("created_at", { ascending: true }),
    admin
      .from("scheduled_tasks")
      .select("*")
      .eq("user_id", session.userId)
      .order("run_at", { ascending: false })
      .limit(50),
  ]);

  const agents = (agentRows ?? []) as Pick<Agent, "id" | "template_id" | "name" | "paused">[];
  const tasks = (taskRows ?? []) as ScheduledTask[];

  const pending = tasks.filter((t) => t.status === "pending");
  const past = tasks.filter((t) => t.status !== "pending");

  const standing = agents
    .filter((a) => a.template_id !== HEAD_AGENT.id)
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
        <h1 className="text-3xl font-extrabold tracking-[-0.02em] text-fg-strong">Scheduled</h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted">
          What runs without you asking. You never have to come here to make one —
          tell your head agent &ldquo;every Monday at 8, send me…&rdquo; and it
          appears in the list below.
        </p>
      </header>

      {pending.length ? (
        <section>
          <h2 className="text-[17px] font-bold text-fg-strong">Things you asked for</h2>
          <ul className="mt-3 space-y-2">
            {pending.map((task) => (
              <li
                key={task.id}
                className="flex items-start gap-3 rounded-xl border border-line bg-surface p-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold leading-snug text-fg-strong">
                    {task.instruction}
                  </p>
                  <p className="mt-1 text-[13px] text-muted">
                    {task.when_label ? `You asked for this ${task.when_label}.` : "Scheduled."}{" "}
                    Runs {new Date(task.run_at).toLocaleString()}.
                  </p>
                </div>
                <span className="shrink-0 rounded-full border border-line px-2.5 py-1 text-[12px] font-semibold text-muted">
                  waiting
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h2 className="text-[17px] font-bold text-fg-strong">Standing work</h2>
        <p className="mt-1 text-[14px] text-muted">
          Each specialist&rsquo;s own rhythm. You did not set these and you do not
          need to — pause an agent on its page if you want one to stop.
        </p>

        {standing.length ? (
          <ul className="mt-4 divide-y divide-line overflow-hidden rounded-xl border border-line">
            {standing.map((row) => (
              <li key={row.id} className="flex items-start gap-3 bg-surface px-4 py-3.5">
                <AgentAvatar name={row.name} seed={row.templateId} size={30} />

                <div className="min-w-0 flex-1">
                  <p className="flex items-baseline gap-2 text-[15px] font-semibold text-fg-strong">
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
            No agents yet. Start your team from the dashboard.
          </p>
        )}
      </section>

      {past.length ? (
        <section>
          <h2 className="text-[17px] font-bold text-fg-strong">Already run</h2>
          <ul className="mt-3 divide-y divide-line overflow-hidden rounded-xl border border-line">
            {past.slice(0, 20).map((task) => (
              <li key={task.id} className="bg-surface px-4 py-3">
                <p className="flex items-baseline justify-between gap-4 text-[14.5px] font-medium text-fg">
                  <span className="truncate">{task.instruction}</span>
                  <span
                    className={
                      task.status === "done"
                        ? "shrink-0 text-[12.5px] font-semibold text-muted"
                        : "shrink-0 text-[12.5px] font-semibold text-danger"
                    }
                  >
                    {task.status}
                  </span>
                </p>
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
