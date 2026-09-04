import Link from "next/link";
import { Reveal } from "@/components/ui/reveal";
import { PACKS, COST, savingPercent, packShape } from "@/lib/credits-public";

/**
 * Pricing, as credits rather than a plan.
 *
 * The subscription this replaces punished both ends of how the product is
 * actually used: a quiet month still cost $29, and a launch week hit a cap. A
 * founder pushes hard for a launch and coasts after it, and a monthly
 * commitment made before they had seen anything work asked them to bet on us
 * before we had earned it.
 *
 * The section leads with the price list rather than the packs. That ordering is
 * the argument: a metered product is only trusted if you can see what an action
 * costs *before* you see what a pack costs, and a founder who can work out the
 * bill themselves stops worrying about it. Hiding the unit price is what makes
 * usage billing feel like a meter running in a taxi.
 */
export function Pricing({ signedIn = false }: { signedIn?: boolean }) {
  return (
    <section id="pricing" className="border-b border-line px-5 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <h2 className="max-w-3xl text-3xl font-extrabold tracking-[-0.02em] sm:text-5xl">
            You pay for work done.
            <br />
            Not for a month you didn&apos;t use.
          </h2>
          <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-muted">
            No subscription and nothing to cancel. Buy credit, spend it when the
            team works, and stop whenever you like — the balance does not expire.
            You start with 500 credits, which is enough to watch it actually run.
          </p>
        </Reveal>

        {/* The price list first. See the note above — this is the part that
            makes the packs underneath legible instead of arbitrary. */}
        <Reveal delay={60}>
          <div className="mt-12 overflow-hidden rounded-xl border border-line">
            <p className="border-b border-line bg-surface-2 px-5 py-3 text-sm font-semibold text-fg-strong">
              What things cost
            </p>
            <ul className="divide-y divide-line">
              {[
                ["Finding leads that match your customer", COST.lead_search, "per search"],
                ["Finding someone's email address", COST.email_lookup, "per person"],
                ["Checking where you rank", COST.rank_check, "per keyword"],
                ["Reading your reviews", COST.review_check, "per check"],
                ["Searching the web", COST.web_search, "per search"],
                ["Reading a page", COST.page_read, "per page"],
                ["Writing a draft or an email", COST.draft, "each"],
                ["Your morning briefing", COST.briefing, "per day"],
              ].map(([label, credits, unit]) => (
                <li
                  key={String(label)}
                  className="flex items-baseline justify-between gap-4 px-5 py-3 text-[15px]"
                >
                  <span className="text-fg">{label}</span>
                  <span className="shrink-0 text-muted">
                    <span className="font-semibold text-fg-strong">
                      {String(credits)}
                    </span>{" "}
                    {credits === 1 ? "credit" : "credits"}{" "}
                    <span className="text-faint">{unit}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {PACKS.map((pack, index) => {
            const saving = savingPercent(pack);
            return (
              <Reveal key={pack.id} delay={100 + index * 60}>
                <div className="flex h-full flex-col rounded-xl border border-line bg-surface p-6">
                  <p className="text-sm font-semibold text-muted">{pack.label}</p>

                  <p className="mt-3 flex items-baseline gap-2">
                    <span className="text-4xl font-extrabold tracking-[-0.02em] text-fg-strong">
                      ${pack.priceUsd}
                    </span>
                    {saving > 0 ? (
                      <span className="text-sm font-semibold text-accent">
                        {saving}% cheaper per credit
                      </span>
                    ) : null}
                  </p>

                  <p className="mt-1 text-[15px] font-semibold text-fg">
                    {pack.credits.toLocaleString("en-US")} credits
                  </p>

                  <p className="mt-3 flex-1 text-sm leading-relaxed text-muted">
                    Roughly {packShape(pack.credits)}.
                  </p>

                  {/* Signed out, the button is signup — buying before there is
                      an account to credit is a payment with nowhere to land.
                      Signed in, it goes to the page that can actually take the
                      money. */}
                  <Link
                    href={signedIn ? "/dashboard/usage" : "/login?mode=signup"}
                    className="mt-6 inline-flex h-12 items-center justify-center rounded-lg border border-line bg-surface-2 text-[15px] font-semibold text-fg-strong transition-colors hover:border-accent-line hover:bg-accent-wash"
                  >
                    {signedIn ? "Add credit" : "Start free — 500 credits"}
                  </Link>
                </div>
              </Reveal>
            );
          })}
        </div>

        <Reveal delay={280}>
          <p className="mt-8 max-w-2xl text-sm leading-relaxed text-faint">
            Every key the agents run on is ours — the models, the data, the web
            reader. You do not sign up for anything else and you do not paste an
            API key. If you would rather your usage ran on your own accounts,
            you can connect them and stop spending credits on ours.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
