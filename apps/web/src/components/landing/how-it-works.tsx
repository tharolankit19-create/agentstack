import { HEAD_AGENT } from "@/lib/army";

/**
 * What you actually have to do.
 *
 * This answers the one question a sceptical founder asks before price: what is
 * asked of me, and how long until something happens. It used to answer it as a
 * numbered 1-2-3 sequence with a badge under each step — which is the single
 * most recognisable layout on a generated page, and it made three genuinely
 * different things look like a countdown to a purchase.
 *
 * So the sequence is stated in time instead. "Two minutes / one click / next
 * morning" is the same information carrying the actual argument, which is that
 * the founder's part ends almost immediately. A rule between each, and nothing
 * else — the one primitive from DESIGN.md.
 *
 * The steps are real. Nothing here describes work the product does not do, and
 * the times are what setup honestly takes.
 */

const STEPS = [
  {
    when: "Two minutes",
    title: "Tell it what you sell",
    body: "Your name, your company, your site. That is the whole form. It reads the site itself to work out who buys from you, so you are not asked to write a customer profile before you have seen it do anything.",
  },
  {
    when: "One click",
    title: `${HEAD_AGENT.defaultName} hires the team`,
    body: "Five specialists — SEO and AEO, research, content, leads, competitor analysis — created and started for you. Nothing to deploy, no servers, no keys. They run on ours.",
  },
  {
    when: "Next morning",
    title: "Read what they did",
    body: "One message on Telegram: what they found, what they wrote, what needs you. Reply to approve. Nothing is published, sent or spent before you say so.",
  },
];

export function HowItWorks() {
  return (
    <section className="border-b border-line px-5 py-20 sm:py-28">
      <div className="mx-auto max-w-3xl">
        <h2 className="text-[34px] tracking-[-0.02em] sm:text-[46px]">
          Your part takes two minutes.
        </h2>

        <div className="mt-14">
          {STEPS.map((step) => (
            <div
              key={step.title}
              className="grid gap-2 border-t border-line py-8 sm:grid-cols-[150px_1fr] sm:gap-8"
            >
              <p className="pt-0.5 text-[15px] font-semibold text-accent">
                {step.when}
              </p>
              <div>
                <h3 className="text-xl font-bold text-fg-strong">{step.title}</h3>
                <p className="mt-2 text-[16px] leading-relaxed text-muted">
                  {step.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
