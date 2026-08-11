import { requireUser, isOnboarded } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { HEAD_AGENT } from "@/lib/army";
import { CommandCenter } from "@/components/dashboard/command-center";
import { ArmyRoster } from "@/components/dashboard/army-roster";
import { OnboardingPrompt } from "@/components/dashboard/onboarding-prompt";
import { DailyBrief } from "@/components/dashboard/daily-brief";
import { HostingCard } from "@/components/dashboard/hosting-card";
import { TelegramCard } from "@/components/dashboard/telegram-card";
import { hostingStatus } from "@/lib/user-hosting";
import { TrialBanner } from "@/components/dashboard/trial-banner";
import { trialState, trialLengthLabel } from "@/lib/trial";
import type { Agent, AgentStats, Generation } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

/**
 * The dashboard.
 *
 * It has exactly one shape: **your head agent, then the squads under it.**
 *
 * The version before this opened on a searchable grid of every template in the
 * catalog, sorted by how much money each one saved, with the logos of the
 * SaaS tools it replaced. That was a store front, and it was the store front
 * for a different product — one about cancelling subscriptions. This product
 * is a marketing team you command. A team is not something you browse.
 *
 * So the first screen a new customer sees asks one question — what is your
 * head agent called and when should it message you — and everything else is
 * created behind that answer. The public directory still exists at /replace,
 * where a grid is the right shape, because a stranger who has never heard of
 * us genuinely does arrive looking for one specific tool.
 */
export default async function DashboardPage() {
  const session = await requireUser();
  const supabase = await createClient();

  const [{ data: agents }, { data: stats }, { data: recent }] = await Promise.all([
    supabase.from("agents").select("*").order("created_at", { ascending: true }),
    supabase.from("agent_stats").select("*"),
    // The brief. Capped at six: past that it stops being a brief.
    supabase
      .from("generations")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  const owned = (agents ?? []) as Agent[];
  const statRows = (stats ?? []) as AgentStats[];

  const head = owned.find((agent) => agent.template_id === HEAD_AGENT.id);
  const deployed = owned.filter((agent) => agent.status === "deployed");

  const hosting = hostingStatus(session.profile);
  const trial = trialState(session.profile);

  return (
    <div className="space-y-8">
      {trial.active || trial.expired || trial.available ? (
        <TrialBanner state={trial} lengthLabel={trialLengthLabel()} />
      ) : null}

      {isOnboarded(session.profile) ? null : (
        <OnboardingPrompt
          firstName={session.profile.full_name?.split(" ")[0] ?? null}
        />
      )}

      {/* The commander. Either the form that creates it and the whole army
          behind it, or the card showing when it reports. */}
      <CommandCenter head={head} />

      {/* Where it reports. Shown until it is connected, because without it the
          squads run and nobody hears about it. */}
      {head ? <TelegramCard /> : null}

      {/* Only rendered when there is something to do about it: a self-hosted
          plan with no Vercel account connected cannot deploy at all, and that
          should be visible here rather than discovered inside a failure. */}
      {hosting.needsToken ? <HostingCard initial={hosting} /> : null}

      <DailyBrief
        generations={(recent ?? []) as Generation[]}
        agents={owned}
        deployedCount={deployed.length}
      />

      <ArmyRoster agents={owned} stats={statRows} />
    </div>
  );
}
