import { requirePaidUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TEMPLATES } from "@/lib/templates";
import { AgentCard } from "@/components/dashboard/agent-card";
import type { Agent, AgentStats } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

/**
 * The agent picker.
 *
 * One card per template. If the customer already made that agent, the card
 * shows its live state instead of a "create" button — same card, two states,
 * so there is never a second place to look for the same agent.
 */
export default async function DashboardPage() {
  const session = await requirePaidUser();
  const supabase = await createClient();

  const [{ data: agents }, { data: stats }] = await Promise.all([
    supabase.from("agents").select("*").order("created_at", { ascending: true }),
    supabase.from("agent_stats").select("*"),
  ]);

  const owned = (agents ?? []) as Agent[];
  const statsById = new Map(
    ((stats ?? []) as AgentStats[]).map((row) => [row.agent_id, row]),
  );
  const byTemplate = new Map(owned.map((agent) => [agent.template_id, agent]));
  const quotaReached = owned.length >= session.profile.agent_quota;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-extrabold text-white">Your agents</h1>
        <p className="mt-2 text-[15px] text-zinc-400">
          {owned.length === 0
            ? "Pick one. It takes four fields and about 90 seconds."
            : `${owned.length} of ${session.profile.agent_quota} agents used.`}
        </p>
      </header>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {TEMPLATES.map((template) => {
          const agent = byTemplate.get(template.id);
          return (
            <AgentCard
              key={template.id}
              template={template}
              agent={agent}
              stats={agent ? statsById.get(agent.id) : undefined}
              quotaReached={quotaReached && !agent}
            />
          );
        })}
      </div>

      {quotaReached ? (
        <p className="rounded-xl border border-[var(--color-surface-line)] bg-[var(--color-surface-raised)] p-4 text-sm text-zinc-400">
          You have used all {session.profile.agent_quota} agents on your plan.
          {session.profile.plan === "starter" ? (
            <>
              {" "}
              <a href="/pricing" className="font-semibold text-[#c4b5fd] hover:underline">
                Pro raises it to 25
              </a>
              .
            </>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
