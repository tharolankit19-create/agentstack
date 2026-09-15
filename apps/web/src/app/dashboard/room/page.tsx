import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadRoom } from "@/lib/room";
import { mentionableAgents, nameOf } from "@/lib/mention";
import { RoomThread } from "@/components/dashboard/room-thread";

export const dynamic = "force-dynamic";

/**
 * The room is intentionally resilient: a missing room migration or transient
 * database failure must never crash the whole dashboard. The founder can still
 * message the team; API writes surface a useful error while this page renders.
 */
export default async function RoomPage() {
  const session = await requireUser("/dashboard/room");
  const admin = createAdminClient();

  const [messagesResult, agentsResult] = await Promise.allSettled([
    loadRoom(admin, session.userId),
    mentionableAgents(admin, session.userId),
  ]);

  const messages =
    messagesResult.status === "fulfilled" ? messagesResult.value : [];
  const agents =
    agentsResult.status === "fulfilled" ? agentsResult.value : [];

  if (messagesResult.status === "rejected") {
    console.error("[room] failed to load messages:", messagesResult.reason);
  }
  if (agentsResult.status === "rejected") {
    console.error("[room] failed to load agents:", agentsResult.reason);
  }

  return (
    <div className="flex h-[calc(100dvh-8rem)] flex-col">
      <header className="pb-5">
        <h1 className="text-3xl font-extrabold tracking-[-0.02em] text-fg-strong">The room</h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted">
          Tell Kryx what you need. Type{" "}
          <span className="font-semibold text-fg">@</span> when you want to hand it
          straight to one specialist.
        </p>
        {messagesResult.status === "rejected" ? (
          <p className="mt-3 rounded-lg border border-line bg-surface-2 px-3 py-2 text-[13px] text-muted">
            The room history could not be loaded, but the rest of your workspace is still available.
            Try again in a moment.
          </p>
        ) : null}
      </header>

      <RoomThread
        initial={messages}
        agents={agents.map((agent) => ({
          name: nameOf(agent),
          seed: agent.template_id,
          commander: agent.template_id === "head-agent",
        }))}
      />
    </div>
  );
}
