import { MessageCircle, Radio } from "lucide-react";
import { Reveal } from "@/components/ui/reveal";
import { AgentAvatar } from "@/components/ui/agent-avatar";
import { HEAD_AGENT, SQUADS, totalAgentCount } from "@/lib/army";

/**
 * The org chart, as the product.
 *
 * "We deploy every kind of agent" is not a position — it describes a feature
 * list and asks the reader to work out what it means for them. "A marketing
 * army with one commander you talk to" is a position, because it answers the
 * question the feature list never did: *who do I actually deal with?*
 *
 * Two things this section is careful about.
 *
 * **It reads the real roster.** The squads and the names below come from
 * `army.ts`, which is the same file the dashboard and the workflow animation
 * read. The previous version had its own hardcoded list of four squads that
 * matched nothing, which is how a landing page ends up describing a product
 * that does not exist.
 *
 * **Everyone has a name.** Not decoration: a founder who gets a message saying
 * "Argus noticed Northwind dropped their price" has somebody to go and check,
 * and a name is what makes the log line legible six weeks later. Every name
 * here is editable in the dashboard.
 */
export function TheArmy() {
  return (
    <section className="border-b border-line px-5 py-16 sm:py-24">
      <div className="mx-auto max-w-5xl">
        <Reveal>
          <p className="microlabel">The structure</p>
          <h2 className="mt-4 max-w-3xl text-3xl font-extrabold leading-tight sm:text-5xl">
            You don&rsquo;t manage {totalAgentCount()} agents.
            <br />
            You talk to <span className="text-accent">one</span>.
          </h2>
          <p className="mt-5 max-w-2xl text-lg text-muted">
            Underneath is a marketing army — {SQUADS.length} squads that
            research, write, prospect, watch reviews and track competitors, all
            running on schedules. Above them is one head agent that reads
            everything they did and messages you. You reply to it like you would
            a colleague.
          </p>
        </Reveal>

        {/* The commander. Deliberately the visual top of the diagram, because
            that is the whole point being made. */}
        <Reveal delay={80}>
          <div className="mt-10 rounded-2xl border-2 border-accent bg-accent/[0.07] p-6">
            <div className="flex flex-wrap items-center gap-3">
              <AgentAvatar
                name={HEAD_AGENT.defaultName}
                seed={HEAD_AGENT.id}
                size={44}
                commander
              />
              <p className="flex flex-wrap items-center gap-2 text-lg font-extrabold text-fg-strong">
                {HEAD_AGENT.defaultName}
                <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-fg">
                  head agent
                </span>
                <span className="text-sm font-medium text-faint">
                  rename it to whatever you like
                </span>
              </p>
            </div>

            <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted">
              &ldquo;Morning. Otis drafted 5 posts, Argus says Northwind dropped
              their starter tier to $19, and one 2-star review needs you
              personally. Reply 1 and I&rsquo;ll send you the lot.&rdquo;
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
              <span className="inline-flex items-center gap-2 font-semibold text-live">
                <MessageCircle className="size-4" aria-hidden />
                Telegram — working today
              </span>
              <span className="inline-flex items-center gap-2 text-faint">
                <Radio className="size-4" aria-hidden />
                WhatsApp — in progress, needs Meta business approval
              </span>
            </div>
          </div>
        </Reveal>

        {/* The squads, one level down, with the people in them. */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {SQUADS.map((squad, index) => (
            <Reveal key={squad.id} delay={120 + index * 50}>
              <div className="flex h-full flex-col rounded-2xl border border-line bg-surface-2 p-5">
                <p className="flex items-center gap-2 font-bold text-fg-strong">
                  <span aria-hidden>{squad.icon}</span>
                  {squad.name}
                  <span className="ml-auto rounded-full border border-line px-2 py-0.5 text-[10px] font-medium text-faint">
                    {squad.cadence}
                  </span>
                </p>
                <p className="mt-2 text-[15px] leading-snug text-muted">
                  {squad.mission}
                </p>

                <ul className="mt-4 flex-1 space-y-2">
                  {squad.pipeline.map((sub) => (
                    <li key={sub.defaultName} className="flex items-center gap-2.5">
                      <AgentAvatar
                        name={sub.defaultName}
                        seed={sub.templateId ?? sub.defaultName}
                        size={26}
                      />
                      <span className="min-w-0 text-sm">
                        <span className="font-bold text-fg-strong">
                          {sub.defaultName}
                        </span>
                        <span className="text-muted"> — {sub.name}</span>
                      </span>
                    </li>
                  ))}
                </ul>

                <p className="mt-4 border-t border-line pt-3 text-xs leading-relaxed text-faint">
                  <span className="font-semibold text-muted">Hands you:</span>{" "}
                  {squad.output}
                </p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={400}>
          <p className="mt-6 border-l-2 border-line pl-5 text-[15px] leading-relaxed text-muted">
            <span className="font-semibold text-fg">
              This is the part nobody else ships.
            </span>{" "}
            Everyone will sell you an agent. An agent is a thing you have to go
            and check. What you actually want is somebody reporting to you — and
            that only works if there is one of them, and it messages you first.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
