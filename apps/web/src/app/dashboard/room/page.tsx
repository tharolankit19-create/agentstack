import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadRoom } from "@/lib/room";
import { mentionableAgents, nameOf } from "@/lib/mention";
import { RoomThread } from "@/components/dashboard/room-thread";

export const dynamic = "force-dynamic";

/**
 * The room.
 *
 * One thread the whole team shares. Agents report into it after they have done
 * something, the head agent directs, and the founder can step in and address
 * anyone by name — and being addressed makes that agent actually work, not
 * reply.
 */
export default async function RoomPage() {
  const session = await requireUser("/dashboard/room");
  const admin = createAdminClient();

  const [messages, agents] = await Promise.all([
    loadRoom(admin, session.userId),
    mentionableAgents(admin, session.userId),
  ]);

  return (
    <div className="flex h-[calc(100dvh-8rem)] flex-col">
      <header className="pb-5">
        <h1 className="text-3xl font-extrabold tracking-[-0.02em] text-fg-strong">The room</h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted">
          Where the team talks. Type <span className="font-semibold text-fg">@</span> and a
          name to put someone on a job — they do the work and report back here,
          rather than promising to.
        </p>
      </header>

      <RoomThread
        initial={messages}
        names={agents.map((agent) => nameOf(agent))}
      />
    </div>
  );
}
