import Link from "next/link";
import { Sparkles } from "lucide-react";
import { requireOnboardedUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canBuildCustomAgents } from "@/lib/plans";
import { TEMPLATES, monthlySavings, formatUsd } from "@/lib/templates";
import { SavingsHeadline } from "@/components/dashboard/savings-headline";
import { AgentLibrary } from "@/components/dashboard/agent-library";
import { Button } from "@/components/ui/button";
import type { Agent, AgentStats, CustomAgent } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

/**
 * The dashboard.
 *
 * It opens with the number the customer bought: what they are no longer
 * paying for. Everything else — the library, the deployed agents — is
 * arranged underneath that one fact, because "you cancelled $347/mo" is the
 * reason they stay subscribed and a grid of cards is not.
 */
export default async function DashboardPage() {
  const session = await requireOnboardedUser();
  const supabase = await createClient();

  const [{ data: agents }, { data: stats }, { data: customAgents }] = await Promise.all([
    supabase.from("agents").select("*").order("created_at", { ascending: true }),
    supabase.from("agent_stats").select("*"),
    supabase
      .from("custom_agents")
      .select("*")
      .order("created_at", { ascending: false }),
  ]);

  const owned = (agents ?? []) as Agent[];
  const custom = (customAgents ?? []) as CustomAgent[];
  const statsById = new Map(
    ((stats ?? []) as AgentStats[]).map((row) => [row.agent_id, row]),
  );

  const deployed = owned.filter((agent) => agent.status === "deployed");

  // Savings count what is actually running. A configured-but-undeployed agent
  // has not replaced anything yet, and claiming otherwise would make the
  // headline a number the customer cannot trust.
  const replaced = monthlySavings(
    deployed.filter((agent) => !agent.custom_agent_id).map((agent) => agent.template_id),
  );
  const customReplaced = deployed
    .filter((agent) => agent.custom_agent_id)
    .reduce((sum, agent) => {
      const spec = custom.find((c) => c.id === agent.custom_agent_id)?.spec;
      return sum + (spec?.replaces.monthlyUsd ?? 0);
    }, 0);

  const generationsThisMonth = [...statsById.values()].reduce(
    (sum, row) => sum + Number(row.generations_this_month ?? 0),
    0,
  );

  return (
    <div className="space-y-10">
      <SavingsHeadline
        monthlyReplaced={replaced + customReplaced}
        planPrice={session.profile.plan === "pro" ? 59 : 29}
        deployedCount={deployed.length}
        generationsThisMonth={generationsThisMonth}
        totalAgents={owned.length}
        quota={session.profile.agent_quota}
      />

      {canBuildCustomAgents(session.profile.plan) ? (
        <Link
          href="/dashboard/custom"
          className="flex flex-wrap items-center gap-4 rounded-2xl border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/[0.07] p-5 transition-colors hover:border-[var(--color-accent)]/60"
        >
          <Sparkles className="size-5 shrink-0 text-[var(--color-accent)]" />
          <div className="min-w-0 flex-1">
            <p className="font-bold text-white">
              Paying for something that is not in the library?
            </p>
            <p className="mt-0.5 text-sm text-zinc-400">
              Paste its URL and we build you an agent that does its job.
              {custom.length > 0
                ? ` You have built ${custom.length} so far.`
                : ""}
            </p>
          </div>
          <Button size="sm" className="shrink-0">
            Build one
          </Button>
        </Link>
      ) : (
        <Link
          href="/pricing"
          className="flex flex-wrap items-center gap-4 rounded-2xl border border-[var(--color-surface-line)] p-5 transition-colors hover:border-zinc-600"
        >
          <Sparkles className="size-5 shrink-0 text-[var(--color-accent)]" />
          <div className="min-w-0 flex-1">
            <p className="font-bold text-white">
              Using a tool we have not built an agent for?
            </p>
            <p className="mt-0.5 text-sm text-zinc-400">
              On Pro you paste its URL and we build one. $59/month, cancel anytime.
            </p>
          </div>
          <Button size="sm" variant="darkOutline" className="shrink-0">
            See Pro
          </Button>
        </Link>
      )}

      <AgentLibrary
        templates={TEMPLATES}
        agents={owned}
        customAgents={custom}
        stats={[...statsById.values()]}
        quota={session.profile.agent_quota}
      />

      {owned.length >= session.profile.agent_quota ? (
        <p className="rounded-xl border border-[var(--color-surface-line)] bg-[var(--color-surface-raised)] p-4 text-sm text-zinc-400">
          You are running all {session.profile.agent_quota} agents on your plan —
          replacing {formatUsd(replaced + customReplaced)}/mo.
          {session.profile.plan === "starter" ? (
            <>
              {" "}
              <Link href="/pricing" className="font-semibold text-[#c4b5fd] hover:underline">
                Pro takes it to 25
              </Link>{" "}
              and lets you build agents from your own tools.
            </>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
