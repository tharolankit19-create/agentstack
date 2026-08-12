import { AgentAvatar } from "@/components/ui/agent-avatar";
import { HEAD_AGENT, SQUADS, totalAgentCount } from "@/lib/army";

/**
 * What a new arrival sees: the whole army, laid out to be admired, not operated.
 *
 * Early access means everyone can look and nobody but the operator can act yet.
 * So this is deliberately read-only — no inputs, no deploy, nothing that fails
 * when tapped. It is the product as a finished thing: a head agent, six squads,
 * fourteen named faces in a tidy grid, so a founder who just signed up sees
 * exactly what they are on the list for.
 *
 * The tone is "you have arrived somewhere real", carried by weight, spacing and
 * one accent — not by neon and grids, which would read as a science-fiction set
 * rather than a place you run a business from.
 */
export function ArmyShowcase({ firstName }: { firstName: string | null }) {
  return (
    <div className="space-y-8">
      {/* You're in. */}
      <section className="overflow-hidden rounded-3xl border border-line bg-gradient-to-b from-surface-2 to-surface shadow-[var(--shadow-lg)]">
        <div className="px-6 py-8 sm:px-10 sm:py-10">
          <p className="microlabel text-accent">Early access · you&rsquo;re on the list</p>
          <h1 className="mt-3 max-w-2xl text-3xl font-extrabold leading-[1.1] text-fg-strong sm:text-4xl">
            {firstName ? `Welcome, ${firstName}. ` : "Welcome. "}
            This is the army that will run your marketing.
          </h1>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted">
            You&rsquo;re early — deploying, keys and hosting open up shortly.
            For now, meet the {totalAgentCount()} agents and the one you&rsquo;ll
            actually talk to. When it&rsquo;s your turn, all of this comes alive
            with a single setup.
          </p>
        </div>

        {/* The commander, front and centre. */}
        <div className="flex flex-wrap items-center gap-4 border-t border-line bg-surface px-6 py-5 sm:px-10">
          <AgentAvatar
            name={HEAD_AGENT.defaultName}
            seed={HEAD_AGENT.id}
            size={56}
            commander
            animated
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-wider text-faint">
              Your head agent
            </p>
            <p className="text-xl font-extrabold text-fg-strong">
              {HEAD_AGENT.defaultName}
            </p>
            <p className="mt-0.5 max-w-lg text-sm text-muted">
              Reads what all six squads produced overnight and sends you one
              message on Telegram. You reply; nothing happens without you.
            </p>
          </div>
        </div>
      </section>

      {/* The squads, as small face-cards in a grid. */}
      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-bold text-fg-strong">The six squads</h2>
          <p className="mt-0.5 text-sm text-muted">
            {totalAgentCount()} specialists, each with a name and one job.
          </p>
        </div>

        <div className="grid gap-4">
          {SQUADS.map((squad) => (
            <div
              key={squad.id}
              className="overflow-hidden rounded-3xl border border-line bg-surface-2 shadow-[var(--shadow)]"
            >
              <div className="flex items-center gap-3 px-5 pt-5">
                <span
                  className="grid size-10 shrink-0 place-items-center rounded-2xl bg-surface-3 text-lg"
                  aria-hidden
                >
                  {squad.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold leading-tight text-fg-strong">
                    {squad.name}
                  </p>
                  <p className="truncate text-sm text-muted">{squad.mission}</p>
                </div>
                <span className="shrink-0 rounded-full bg-surface-3 px-2.5 py-1 text-xs font-medium text-faint">
                  {squad.cadence}
                </span>
              </div>

              <div className="grid gap-2.5 p-4 sm:grid-cols-2 xl:grid-cols-3">
                {squad.pipeline.map((sub) => (
                  <div
                    key={sub.defaultName}
                    className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3"
                  >
                    <AgentAvatar
                      name={sub.defaultName}
                      seed={sub.templateId ?? sub.defaultName}
                      size={36}
                      animated
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-fg-strong">
                        {sub.defaultName}
                      </p>
                      <p className="truncate text-[11px] font-medium uppercase tracking-wide text-faint">
                        {sub.name}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <p className="rounded-2xl border border-dashed border-line px-5 py-4 text-center text-sm text-muted">
        You&rsquo;re on the early-access list. We&rsquo;ll let you know the
        moment you can deploy your own army.
      </p>
    </div>
  );
}
