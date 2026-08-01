import { Demo } from "./demo";
import { BuyButton } from "./buy-button";
import { PLANS } from "@/lib/plans";

/**
 * 80% of visitors never scroll past this. So the hero has to do all of it:
 * say what this is, why it matters, prove it works, and ask for the money.
 */
export function Hero() {
  return (
    <section className="border-b border-[var(--color-line)] px-5 py-16 sm:py-24">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-[40px] font-extrabold leading-[1.05] sm:text-6xl">
          Your marketing team costs
          <br />
          $2,000 a month.
          <br />
          <span className="text-[var(--color-accent)]">Mine costs $29. Once.</span>
        </h1>

        <p className="mt-6 max-w-xl text-lg leading-relaxed text-[var(--color-ink-soft)] sm:text-xl">
          Three AI agents that write your posts, reply to your reviews, and find
          your leads. Each one runs on its own URL, on a schedule, without you.
          Live in 90 seconds.
        </p>

        <div className="mt-8">
          <BuyButton plan="starter">{PLANS.starter.cta}</BuyButton>
          <p className="mt-3 text-sm text-[var(--color-ink-soft)]">
            One payment. No subscription. 3 agents, yours forever.
          </p>
        </div>

        <div className="mt-12">
          <Demo />
        </div>
      </div>
    </section>
  );
}
