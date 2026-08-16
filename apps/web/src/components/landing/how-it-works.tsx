import { HEAD_AGENT, totalAgentCount } from "@/lib/army";

/**
 * How it works — three steps, and the honest time each one takes.
 *
 * The page had a claim, a diagram and a price, and nothing in between that
 * answered the question a sceptical founder actually asks: what do I have to do,
 * and how long until something happens? Every landing page that converts on this
 * shape answers it in three numbered steps with a time attached to each, because
 * "five minutes" is the objection being handled — not "is this clever".
 *
 * The steps are the real ones. Nothing here describes work the product does not
 * do, and the times are what setup honestly takes: the answers go into the
 * agents, the team is created for you, and the first output lands on the next
 * scheduled run rather than instantly.
 */

const STEPS = [
  {
    n: 1,
    title: "Answer four questions",
    body: "Your site, your customer, your rivals. That is the entire setup — the answers go straight into every agent so they know what you sell before they write anything.",
    chip: "About 2 minutes",
  },
  {
    n: 2,
    title: "Your army gets built",
    body: `${HEAD_AGENT.defaultName} and ${totalAgentCount()} agents are created and started for you. No deploying, no servers, no keys per agent — we run the whole team.`,
    chip: "One click",
  },
  {
    n: 3,
    title: "Read what they made",
    body: "They research your market, watch competitors and write drafts on their own schedule. You get one message a day on Telegram and reply 1 to approve. Nothing publishes without you.",
    chip: "First results next morning",
  },
];

export function HowItWorks() {
  return (
    <section className="border-b border-line px-5 py-20">
      <div className="mx-auto max-w-4xl">
        <h2 className="text-[34px] sm:text-[46px]">How it works</h2>
        <p className="mt-3 max-w-xl text-lg text-muted">
          Three steps. Then it runs without you — which is the entire point.
        </p>

        <ol className="mt-12 space-y-10">
          {STEPS.map((step, index) => (
            <li key={step.n} className="relative flex gap-5 sm:gap-7">
              {/* The rail between the steps, so it reads as a sequence and not
                  three unrelated cards. */}
              {index < STEPS.length - 1 ? (
                <span
                  className="absolute left-[19px] top-12 h-[calc(100%+8px)] w-px bg-line sm:left-[23px]"
                  aria-hidden
                />
              ) : null}

              <span className="relative grid size-10 shrink-0 place-items-center rounded-full border border-line-strong bg-surface-2 text-base font-extrabold text-fg-strong sm:size-12">
                {step.n}
              </span>

              <div className="min-w-0 flex-1 pt-1">
                <h3 className="text-xl font-extrabold text-fg-strong">
                  {step.title}
                </h3>
                <p className="mt-2 max-w-2xl leading-relaxed text-muted">
                  {step.body}
                </p>
                <span className="mt-3 inline-flex rounded-full border border-line bg-surface-2 px-3 py-1 text-xs font-semibold text-muted">
                  {step.chip}
                </span>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
