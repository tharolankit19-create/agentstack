import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { HEAD_AGENT } from "@/lib/army";
import { canOperate } from "@/lib/plans";
import { CommandCenter } from "@/components/dashboard/command-center";
import { TodayCard } from "@/components/dashboard/today-card";
import { ArmyShowcase } from "@/components/dashboard/army-showcase";
import { NextStep } from "@/components/dashboard/next-step";
import { LatestAlerts } from "@/components/dashboard/latest-alerts";
import { NeedsYou } from "@/components/dashboard/needs-you";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadMissions, inLane } from "@/lib/missions";
import { HostingCard } from "@/components/dashboard/hosting-card";
import { TelegramCard } from "@/components/dashboard/telegram-card";
import { hostingStatus } from "@/lib/user-hosting";
import { TrialBanner } from "@/components/dashboard/trial-banner";
import { trialState, trialLengthLabel } from "@/lib/trial";
import type { Agent, Generation } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

/**
 * The dashboard.
 *
 * There is exactly one path through it, and at any moment exactly one thing to
 * do. Set up your head agent → connect Telegram → deploy everything → read
 * what happened. The founder is never shown two calls to action at once,
 * because a founder shown four does none of them.
 *
 * Once the army is running, this page answers two questions and stops: how much
 * got done, and what each agent last said. It used to answer more — a live
 * activity animation, a roster with per-agent statistics, a brief listing every
 * generation — which between them said "the machine is on" three times over and
 * "here is what your team found" not at all. The animation was the worst of it:
 * motion reads as progress, so a founder watched dots travel between faces and
 * came away feeling informed without having learned anything.
 *
 * Depth did not disappear, it moved to where it is asked for. Per-agent history
 * and chat live on that agent's own page, one click from every row here.
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

  // Early access: everyone can look, only the operator can act. A new arrival
  // gets the showcase — the whole army, read-only — not a control panel with
  // buttons that all refuse. The server-side guards refuse anyway; this is so
  // they are never shown a button that will.
  if (!canOperate(session.profile)) {
    return (
      <ArmyShowcase firstName={session.profile.full_name?.split(" ")[0] ?? null} />
    );
  }

  const supabase = await createClient();

  // Midnight, the founder's local-ish day boundary. Server-side we only have
  // UTC, which is close enough for a "what happened today" count — the tile is a
  // reassurance, not an accountant.
  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);

  const [
    { data: agents },
    { data: recent },
    { data: link },
    { data: todays },
    { count: pending },
  ] = await Promise.all([
    supabase.from("agents").select("*").order("created_at", { ascending: true }),
    // Enough rows to find the newest output for each agent. One row per agent
    // is what renders, but they have to be read newest-first across all of
    // them, so the window has to be wider than the agent count.
    supabase
      .from("generations")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(60),
    supabase.from("telegram_links").select("chat_id").maybeSingle(),
    // Everything produced since midnight, for the Today card.
    supabase
      .from("generations")
      .select("kind")
      .gte("created_at", startOfToday.toISOString()),
    // How many drafts are still waiting on the founder to approve.
    supabase
      .from("generations")
      .select("id", { count: "exact", head: true })
      .eq("approved", false),
  ]);

  const owned = (agents ?? []) as Agent[];

  // The board, read once and shared: the home page shows only what is blocked
  // on the founder, and Mission Control shows everything.
  const missions = await loadMissions(createAdminClient(), session.userId);
  const blocked = inLane(missions, "needs_you", 6);

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

      {/* ── The one-glance answer: what got done today, what needs you ──────
          For a non-technical founder this is the whole dashboard — four plain
          numbers and a review button. Everything below is for when they want
          to go deeper. */}
      {head ? (
        <TodayCard
          todays={(todays ?? []) as { kind: string }[]}
          pending={pending ?? 0}
          headId={head.id}
        />
      ) : null}

      {/* What is blocked on the founder, before anything else they could read.
          This is the whole proposition: they are the bottleneck for approvals
          and for nothing else, so the things waiting on them come first and
          everything else is below the fold. */}
      {head ? <NeedsYou missions={blocked} total={missions.filter((m) => m.lane === "needs_you").length} /> : null}

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

      {/* ── Then: what each agent last said ─────────────────────────────
          One line per agent, newest first, silent ones at the bottom rather
          than hidden — a squad that has gone quiet is information too. */}
      {deployed.length > 0 ? (
        <LatestAlerts agents={owned} generations={(recent ?? []) as Generation[]} />
      ) : null}

      {/* Telegram stays reachable once connected, so it can be swapped or
          disconnected — just not as a call to action competing with the one
          above it. */}
      {head && telegramConnected ? <TelegramCard /> : null}
    </div>
  );
}
