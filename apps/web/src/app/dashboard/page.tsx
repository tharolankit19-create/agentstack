import Link from "next/link";
import { Sparkles } from "lucide-react";
import { requireUser, isOnboarded } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canBuildCustom, quotaFor } from "@/lib/plans";
import { TEMPLATES, monthlySavings, formatUsd } from "@/lib/templates";
import { rosterTemplateIds } from "@/lib/army";
import { SavingsHeadline } from "@/components/dashboard/savings-headline";
import { AgentLibrary } from "@/components/dashboard/agent-library";
import { OnboardingPrompt } from "@/components/dashboard/onboarding-prompt";
import { DailyBrief } from "@/components/dashboard/daily-brief";
import { HostingCard } from "@/components/dashboard/hosting-card";
import { TelegramCard } from "@/components/dashboard/telegram-card";
import { DeployArmy } from "@/components/dashboard/deploy-army";
import { hostingStatus } from "@/lib/user-hosting";
import { TrialBanner } from "@/components/dashboard/trial-banner";
import { trialState, trialLengthLabel } from "@/lib/trial";
import { Button } from "@/components/ui/button";
import type { Agent, AgentStats, CustomAgent, Generation } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

/**
 * The dashboard.
 *
 * It opens with **what the agents did**, not with a catalogue.
 *
 * The earlier version led with a browse list of every tool you might cancel,
 * and a browse list is something you look at once. The reason to open this tab
 * on a Tuesday is that work happened overnight and it is sitting here. Dead
 * dashboards are pages you check; this one is supposed to have produced
 * something since you last looked.
 *
 * Order: what landed, what it saved, then the library. The directory still
 * exists and is still good — it lives at /replace, where it does its real job
 * of being findable by people who have never heard of us.
 */
export default async function DashboardPage() {
  const session = await requireUser();
  const supabase = await createClient();

  const [{ data: agents }, { data: stats }, { data: customAgents }, { data: recent }] =
    await Promise.all([
      supabase.from("agents").select("*").order("created_at", { ascending: true }),
      supabase.from("agent_stats").select("*"),
      supabase
        .from("custom_agents")
        .select("*")
        .order("created_at", { ascending: false }),
      // The brief. Capped at six: past that it stops being a brief.
      supabase
        .from("generations")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(6),
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

  // Only the army. The catalog is bigger because the public directory needs it
  // to be, but a customer's dashboard should show the team they bought.
  const roster = rosterTemplateIds();
  const rosterTemplates = roster
    .map((id) => TEMPLATES.find((template) => template.id === id))
    .filter((template): template is NonNullable<typeof template> => Boolean(template));

  const hosting = hostingStatus(session.profile);
  const trial = trialState(session.profile);
  const quota = quotaFor(session.profile);

  return (
    <div className="space-y-10">
      {trial.active || trial.expired ? (
        <TrialBanner state={trial} lengthLabel={trialLengthLabel()} />
      ) : null}

      {isOnboarded(session.profile) ? null : (
        <OnboardingPrompt
          firstName={session.profile.full_name?.split(" ")[0] ?? null}
        />
      )}

      {/* One click to put the whole army on the board. Disappears once it is
          all there, rather than sitting as a permanent dead button. */}
      <DeployArmy alreadyHave={owned.length} />

      <DailyBrief
        generations={(recent ?? []) as Generation[]}
        agents={owned}
        deployedCount={deployed.length}
      />

      {/* Only rendered when there is something to do about it: a self-hosted
          plan with no Vercel account connected cannot deploy at all, and that
          should be visible here rather than discovered inside a failure. */}
      {hosting.needsToken ? <HostingCard initial={hosting} /> : null}

      {/* Where the head agent reports. Shown until it is connected, because
          without it the squads run and nobody hears about it. */}
      <TelegramCard />

      <SavingsHeadline
        monthlyReplaced={replaced + customReplaced}
        planPrice={session.profile.plan === "pro" ? 59 : 29}
        deployedCount={deployed.length}
        generationsThisMonth={generationsThisMonth}
        totalAgents={owned.length}
        quota={quota}
      />

      {canBuildCustom(session.profile) ? (
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
              Paying for a tool no squad covers?
            </p>
            <p className="mt-0.5 text-sm text-muted">
              On Army you paste its URL and we build you an agent for it.
              $59/month, cancel anytime.
            </p>
          </div>
          <Button size="sm" variant="darkOutline" className="shrink-0">
            See Pro
          </Button>
        </Link>
      )}

      <AgentLibrary
        templates={rosterTemplates}
        agents={owned}
        customAgents={custom}
        stats={[...statsById.values()]}
        quota={quota}
      />

      {owned.length >= quota ? (
        <p className="rounded-xl border border-line bg-surface-2 p-4 text-sm text-muted">
          You are running all {quota} agents on your plan —
          replacing {formatUsd(replaced + customReplaced)}/mo.
          {session.profile.plan === "starter" ? (
            <>
              {" "}
              <Link href="/pricing" className="font-semibold text-accent hover:underline">
                Army gives you all six squads
              </Link>
              , or Commander drops the cap entirely.
            </>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
