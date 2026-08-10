import { MessageCircle, Radio, Users } from "lucide-react";
import { Reveal } from "@/components/ui/reveal";
import { TEMPLATES } from "@/lib/templates";

/**
 * The org chart, as the product.
 *
 * "We deploy every kind of agent" is not a position — it describes a feature
 * list and asks the reader to work out what it means for them. "A marketing
 * army with one commander you talk to" is a position, because it answers the
 * question the feature list never did: *who do I actually deal with?*
 *
 * The structure is real, not a metaphor we drew afterwards. The specialists
 * are the catalog agents that already exist and already run on schedules. The
 * commander is the reporting layer over them: it reads what they produced and
 * sends you one message instead of you opening a dashboard to find six.
 *
 * Honesty note, because this section is where it would be easiest to lie:
 * Telegram is built and works today — a bot token and a chat id, about a
 * minute of setup. WhatsApp needs Meta's Business API, a verified business
 * and approved message templates, so it is marked as what it is rather than
 * listed next to Telegram as though both were ready.
 */

const SQUADS = [
  {
    name: "Content squad",
    does: "Writes the posts, the blog, the newsletter, the repurposed clips.",
    replaces: "Buffer, Hootsuite, Jasper, Copy.ai",
  },
  {
    name: "Demand squad",
    does: "Finds leads, writes the openers, chases what went quiet.",
    replaces: "Apollo, Lemlist, Instantly",
  },
  {
    name: "Reputation squad",
    does: "Watches reviews and communities, drafts every reply.",
    replaces: "Birdeye, Reputation.com, Syften",
  },
  {
    name: "Intel squad",
    does: "Reads competitors daily, reports only what actually changed.",
    replaces: "Crayon, Klue, Ahrefs alerts",
  },
];

export function TheArmy() {
  return (
    <section className="border-b border-line px-5 py-16 sm:py-24">
      <div className="mx-auto max-w-5xl">
        <Reveal>
          <p className="microlabel">The structure</p>
          <h2 className="mt-4 max-w-3xl text-3xl font-extrabold leading-tight sm:text-5xl">
            You don&rsquo;t manage {TEMPLATES.length} agents.
            <br />
            You talk to <span className="text-accent">one</span>.
          </h2>
          <p className="mt-5 max-w-2xl text-lg text-muted">
            Underneath is a marketing army — squads that write, prospect, watch
            reviews, and track competitors, all running on schedules. Above them
            is a commander that reads everything they did and sends you one
            message. You reply to it like you would a colleague.
          </p>
        </Reveal>

        {/* The commander. Deliberately the visual top of the diagram, because
            that is the whole point being made. */}
        <Reveal delay={80}>
          <div className="mt-10 rounded-2xl border-2 border-accent bg-accent/[0.07] p-6">
            <p className="flex flex-wrap items-center gap-2 font-bold text-fg-strong">
              <Radio className="size-4 text-accent" aria-hidden />
              The Commander
              <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-fg">
                talks to you
              </span>
            </p>
            <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted">
              &ldquo;3 replies drafted overnight, one review needs you
              personally, and Northwind changed their pricing page. Want the
              draft replies?&rdquo;
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
              <span className="inline-flex items-center gap-2 font-semibold text-live">
                <MessageCircle className="size-4" aria-hidden />
                Telegram — working today
              </span>
              <span className="inline-flex items-center gap-2 text-faint">
                <MessageCircle className="size-4" aria-hidden />
                WhatsApp — in progress, needs Meta business approval
              </span>
            </div>
          </div>
        </Reveal>

        {/* The squads, one level down. */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {SQUADS.map((squad, index) => (
            <Reveal key={squad.name} delay={120 + index * 60}>
              <div className="h-full rounded-2xl border border-line bg-surface-2 p-5">
                <p className="flex items-center gap-2 font-bold text-fg-strong">
                  <Users className="size-4 text-muted" aria-hidden />
                  {squad.name}
                </p>
                <p className="mt-2 text-[15px] leading-snug text-muted">
                  {squad.does}
                </p>
                <p className="mt-3 border-t border-line pt-3 text-xs text-faint">
                  Replaces <span className="font-semibold">{squad.replaces}</span>
                </p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={340}>
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
