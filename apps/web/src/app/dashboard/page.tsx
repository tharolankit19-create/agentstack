import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { HEAD_AGENT } from "@/lib/army";
import { CommandCenter } from "@/components/dashboard/command-center";
import { ArmyRoster } from "@/components/dashboard/army-roster";
import { NextStep } from "@/components/dashboard/next-step";
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
 * There is exactly one path through it, and at any moment exactly one thing to
 * do. Set up your head agent → connect Telegram → deploy everything → read
 * what happened. The founder is never shown two calls to action at once,
 * because a founder shown four does none of them.
 *
 * That is a change from the version before, which opened on a searchable grid
 * of every template in the catalog, sorted by how much money each one saved,
 * carrying the logos of the SaaS tools it replaced — a store front, and a store
 * front for a different product. It also put a Deploy button on each of
 * fourteen cards, which made turning the army on look like fourteen decisions
 * rather than one.
 *
 * The public directory still lives at /replace, where a grid is the right
 * shape, because a stranger who has never heard of us genuinely does arrive
 * looking for one specific tool.
 */
export default async function DashboardPage() {
  const session = await requireUser();
  const supabase = await createClient();

  const [{ data: agents }, { data: stats }, { data: recent }, { data: link }] =
    await Promise.all([
      supabase.from("agents").select("*").order("created_at", { ascending: true }),
      supabase.from("agent_stats").select("*"),
      // The brief. Capped at six: past that it stops being a brief.
      supabase
        .from("generations")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(6),
      supabase.from("telegram_links").select("chat_id").maybeSingle(),
    ]);

  const owned = (agents ?? []) as Agent[];
  const statRows = (stats ?? []) as AgentStats[];

  const head = owned.find((agent) => agent.template_id === HEAD_AGENT.id);
  const deployed = owned.filter((agent) => agent.status === "deployed");
  const live = deployed.filter((agent) => !agent.paused);
  const broken = owned.filter((agent) => agent.status === "error");
  const waiting = owned.filter(
    (agent) => agent.status !== "deployed" && agent.status !== "error",
  );

  const telegramConnected = Boolean((link as { chat_id?: string | null } | null)?.chat_id);
  const hosting = hostingStatus(session.profile);
  const trial = trialState(session.profile);

  return (
    <div className="space-y-8">
      {trial.active || trial.expired || trial.available ? (
        <TrialBanner state={trial} lengthLabel={trialLengthLabel()} />
      ) : null}

      {/* ── Step one: the commander ────────────────────────────────────────
          Either the seven-question setup that creates the whole army, or the
          card showing when it reports once it exists. The old onboarding
          "survey" prompt above this was noise on top of the one thing that
          matters — it is gone. */}
      <CommandCenter head={head} />

      {/* ── Step two: somewhere to report ──────────────────────────────────
          Only once there is a head agent, and only until it is connected. The
          head agent's entire promise is that it messages you, so this is the
          one step that cannot be skipped. */}
      {head && !telegramConnected ? <TelegramCard /> : null}

      {/* A self-hosted plan with no Vercel account connected cannot deploy at
          all, and that should be visible here rather than discovered inside a
          failure. */}
      {head && hosting.needsToken ? <HostingCard initial={hosting} /> : null}

      {/* ── Step three: one button ─────────────────────────────────────────
          Held back until Telegram is linked, because an army deployed with
          nowhere to report is an army whose output nobody sees. */}
      {head && telegramConnected && !hosting.needsToken ? (
        <NextStep
          total={owned.length}
          live={live.length}
          pending={waiting.length}
          broken={broken.length}
        />
      ) : null}

      {/* ── Then: what actually happened ───────────────────────────────── */}
      {deployed.length > 0 ? (
        <DailyBrief
          generations={(recent ?? []) as Generation[]}
          agents={owned}
          deployedCount={deployed.length}
        />
      ) : null}

      {owned.length > 0 ? <ArmyRoster agents={owned} stats={statRows} /> : null}

      {/* Telegram stays reachable once connected, so it can be swapped or
          disconnected — just not as a call to action competing with the one
          above it. */}
      {head && telegramConnected ? <TelegramCard /> : null}
    </div>
  );
}
