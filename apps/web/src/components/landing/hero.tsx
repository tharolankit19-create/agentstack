import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { SQUADS, totalAgentCount } from "@/lib/army";
import { PLANS } from "@/lib/plans";

/**
 * The top of the page.
 *
 * The old hero opened on a catalogue — "cancel N subscriptions" — and led with
 * a browse list. That sold a directory. This one sells the thing the product
 * actually is: a team that works overnight and reports to you in the morning,
 * on a channel you already have open.
 *
 * The headline says what arrives, not what it costs you to run. Nobody wakes
 * up wanting to manage agents; they want the work already done. So the promise
 * is the outcome, the subhead is the mechanism, and the proof strip underneath
 * is the three facts a sceptic checks before reading further — how many agents,
 * whose keys, and whether it can act without asking.
 *
 * Every number is computed from the army definition. A hero claiming a figure
 * the product cannot produce is the first thing anyone checks.
 */
export function Hero() {
  const agents = totalAgentCount();

  return (
    <section className="grid-field border-b border-line px-5 pb-16 pt-12 sm:pt-16">
      <div className="mx-auto max-w-6xl">
        <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-surface-2 px-3.5 py-1.5 text-sm font-medium text-muted">
          <span className="size-1.5 rounded-full bg-live" aria-hidden />
          {BRAND.manifesto}
        </p>

        <h1 className="max-w-4xl text-[44px] sm:text-[76px]">
          Your marketing team
          <br />
          <span className="text-money">works while you sleep.</span>
        </h1>

        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted">
          {agents} agents in {SQUADS.length} squads — research, content,
          competitor intel, trends, outreach, reputation. One head agent reads
          everything they did and{" "}
          <span className="font-semibold text-fg">
            messages you the plan on Telegram
          </span>{" "}
          every morning. You reply <span className="font-semibold text-fg">1</span>{" "}
          to approve.
        </p>

        <div className="mt-9 flex flex-col gap-4 sm:flex-row sm:items-center">
          <Link
            href="/login?mode=signup"
            className="group inline-flex h-14 items-center justify-center gap-2.5 rounded-xl bg-accent px-7 text-[17px] font-semibold text-accent-fg transition-transform hover:scale-[1.02] active:translate-y-px"
          >
            Start my army — 1 day trial
            <ArrowRight className="size-5 transition-transform group-hover:translate-x-0.5" />
          </Link>

          <p className="text-sm text-muted">
            No card. Full access immediately.
            <br className="hidden sm:block" />
            <span className="font-semibold text-fg">
              ${PLANS.starter.priceUsd}/mo
            </span>{" "}
            after that, cancel in one click.
          </p>
        </div>

        {/* The three objections that stop the scroll, answered before they are
            asked. Each is a fact about the product, not an adjective. */}
        <ul className="mt-10 grid gap-3 sm:grid-cols-3">
          {[
            {
              title: "Your keys, your bill",
              body: "Bring OpenAI, Anthropic, OpenRouter — whichever you use. You pay them directly, at cost.",
            },
            {
              title: "Your infrastructure",
              body: "Agents deploy to your own Vercel account. We never hold a key that spends your money.",
            },
            {
              title: "Nothing acts alone",
              body: "Every post, email and reply waits for your approval. Zero autonomous sending.",
            },
          ].map((item) => (
            <li
              key={item.title}
              className="rounded-xl border border-line bg-surface-2 p-4"
            >
              <p className="flex items-center gap-2 text-sm font-bold text-fg-strong">
                <Check className="size-4 shrink-0 text-live" aria-hidden />
                {item.title}
              </p>
              <p className="mt-1.5 text-sm leading-snug text-muted">{item.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
