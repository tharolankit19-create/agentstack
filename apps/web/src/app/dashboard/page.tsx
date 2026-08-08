import Link from "next/link";
import { Sparkles } from "lucide-react";
import { requireUser, isOnboarded } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canBuildCustomAgents } from "@/lib/plans";
import { AgentLeaderboard } from "@/components/landing/agent-leaderboard";
import { REPLACEABLES } from "@/lib/replaceability";
import { TEMPLATES, monthlySavings, formatUsd } from "@/lib/templates";
import { SavingsHeadline } from "@/components/dashboard/savings-headline";
import { AgentLibrary } from "@/components/dashboard/agent-library";
import { OnboardingPrompt } from "@/components/dashboard/onboarding-prompt";
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
  const session = await requireUser();
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
      {isOnboarded(session.profile) ? null : (
        <OnboardingPrompt
          firstName={session.profile.full_name?.split(" ")[0] ?? null}
        />
      )}

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
          className="flex flex-wrap items-center gap-4 rounded-2xl border border-accent/30 bg-accent/[0.07] p-5 transition-colors hover:border-accent/60"
        >
          <Sparkles className="size-5 shrink-0 text-accent" />
          <div className="min-w-0 flex-1">
            <p className="font-bold text-fg-strong">
              Paying for something that is not in the library?
            </p>
            <p className="mt-0.5 text-sm text-muted">
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
          className="flex flex-wrap items-center gap-4 rounded-2xl border border-line p-5 transition-colors hover:border-line-strong"
        >
          <Sparkles className="size-5 shrink-0 text-accent" />
          <div className="min-w-0 flex-1">
            <p className="font-bold text-fg-strong">
              Using a tool we have not built an agent for?
            </p>
            <p className="mt-0.5 text-sm text-muted">
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

      {/* The same list the landing page opens with, below the customer's own
          agents. Somebody who has already deployed three is exactly the person
          who wants to know what else on their card can go, and making them go
          back out to the marketing site to find out is absurd. */}
      <section>
        <div className="mb-4">
          <h2 className="text-xl">What else are you still paying for?</h2>
          <p className="mt-1 text-sm text-muted">
            Tick anything on your card. The ones we cannot replace say so.
          </p>
        </div>
        <AgentLeaderboard
          entries={REPLACEABLES}
          makeHref="/dashboard/deploy"
          compact
        />
      </section>

      {owned.length >= session.profile.agent_quota ? (
        <p className="rounded-xl border border-line bg-surface-2 p-4 text-sm text-muted">
          You are running all {session.profile.agent_quota} agents on your plan —
          replacing {formatUsd(replaced + customReplaced)}/mo.
          {session.profile.plan === "starter" ? (
            <>
              {" "}
              <Link href="/pricing" className="font-semibold text-accent hover:underline">
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
