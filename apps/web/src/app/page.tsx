import Link from "next/link";
import { ArrowRight, Check, Minus } from "lucide-react";
import { FloatingHeader } from "@/components/landing/floating-header";
import { Hero } from "@/components/landing/hero";
import { DemoConsole } from "@/components/landing/demo-console";
import { HowItWorks } from "@/components/landing/how-it-works";
import { TheArmy } from "@/components/landing/the-army";
import { Footer } from "@/components/landing/footer";
import { getSession } from "@/lib/auth";
import { HEAD_AGENT } from "@/lib/army";
import { COST, PACKS } from "@/lib/credits-public";
import { SITE, twitterUrl } from "@/lib/site";

const FLOW = [
  ["Specialist", "Kryx picks the agent whose job matches the outcome."],
  ["Live source", "It picks the lowest-cost healthy source that can return useful evidence."],
  ["Approval", "Anything consequential waits for the founder before it leaves the workspace."],
] as const;

const COMPARE = [
  ["One goal coordinates the whole team", true, false],
  ["Named specialists with persistent roles", true, false],
  ["Live data/tool routing when the task needs it", true, "manual"],
  ["Scheduled recurring work", true, "extra setup"],
  ["One approval queue for consequential actions", true, "manual"],
  ["One prepaid balance; no monthly subscription", true, false],
] as const;

export default async function LandingPage() {
  const session = await getSession().catch(() => null);
  const twitter = twitterUrl();
  const pricingPacks = [PACKS[0], PACKS[2], PACKS[3]].filter(Boolean);

  return (
    <>
      <FloatingHeader signedIn={Boolean(session)} />
      <main>
        <Hero />

        <section id="demo" className="border-b border-line px-5 py-16 sm:py-24">
          <div className="mx-auto max-w-6xl">
            <div className="mb-8 grid gap-5 lg:grid-cols-[.72fr_1.28fr] lg:items-end">
              <div>
                <p className="microlabel">Try the product before you pay</p>
                <h2 className="mt-4 text-4xl font-extrabold tracking-[-.045em] text-fg-strong sm:text-6xl">
                  Click through the work loop.
                </h2>
              </div>
              <div className="lg:pl-8">
                <p className="max-w-xl text-[16px] leading-7 text-muted">
                  Open a mission, approve it, ask Kryx a question and inspect a lead. The demo uses sample data and says so.
                </p>
                <Link href="/demo" className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-fg-strong">
                  Open the full demo <ArrowRight className="size-4" />
                </Link>
              </div>
            </div>
            <DemoConsole headName={HEAD_AGENT.defaultName} />
          </div>
        </section>

        <TheArmy />

        <section className="border-b border-line px-5 py-16 sm:py-24">
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto max-w-4xl text-center">
              <p className="microlabel">The operating model</p>
              <h2 className="mt-4 text-4xl font-extrabold tracking-[-.045em] text-fg-strong sm:text-6xl">
                8 agents. 1 room. 1 balance.
              </h2>
              <p className="mx-auto mt-5 max-w-2xl text-[16px] leading-7 text-muted">
                You should not need eight tabs, eight subscriptions or eight prompts to get one marketing outcome.
              </p>
            </div>

            <div className="mt-10 grid overflow-hidden rounded-[22px] border border-line md:grid-cols-3">
              {[["8", "named agents", "Kryx plus 7 specialists with distinct jobs and identities."], ["1", "approval queue", "The founder sees the few decisions that actually need a human."], ["$0", "monthly subscription", "Use prepaid credits. Start with 100 and add more from $5."]].map(([value, label, copy], index) => (
                <div key={label} className={`p-7 ${index < 2 ? "border-b border-line md:border-b-0 md:border-r" : ""}`}>
                  <p className="text-5xl font-extrabold tracking-[-.06em] text-accent">{value}</p>
                  <p className="mt-2 text-lg font-extrabold text-fg-strong">{label}</p>
                  <p className="mt-3 text-sm leading-6 text-muted">{copy}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-line px-5 py-16 sm:py-24">
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto max-w-4xl text-center">
              <p className="microlabel">Tool routing</p>
              <h2 className="mt-4 text-4xl font-extrabold tracking-[-.045em] text-fg-strong sm:text-6xl">
                Ask for the outcome. Kryx picks the route.
              </h2>
            </div>

            <div className="mx-auto mt-10 grid max-w-5xl overflow-hidden rounded-[22px] border border-line md:grid-cols-3">
              {FLOW.map(([title, copy], index) => (
                <div key={title} className={`p-6 sm:p-7 ${index < FLOW.length - 1 ? "border-b border-line md:border-b-0 md:border-r" : ""}`}>
                  <p className="font-mono text-xs font-bold text-accent">0{index + 1}</p>
                  <h3 className="mt-8 text-xl font-extrabold text-fg-strong">{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-muted">{copy}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <HowItWorks />

        <section className="border-b border-line px-5 py-16 sm:py-24">
          <div className="mx-auto max-w-6xl">
            <div className="grid gap-10 lg:grid-cols-[.72fr_1.28fr]">
              <div>
                <p className="microlabel">Why switch</p>
                <h2 className="mt-4 text-4xl font-extrabold tracking-[-.045em] text-fg-strong sm:text-5xl">
                  Kryx vs. a pile of AI chats and point tools.
                </h2>
                <p className="mt-5 max-w-sm text-sm leading-6 text-muted">
                  The difference is not another model. It is who coordinates the work, keeps the context and returns a decision-ready result.
                </p>
              </div>

              <div className="overflow-hidden rounded-[22px] border border-line">
                <div className="grid grid-cols-[1fr_90px_110px] border-b border-line bg-surface-2 px-4 py-3 text-xs font-bold text-faint sm:grid-cols-[1fr_130px_150px]">
                  <span>Capability</span><span>KryxAI</span><span>Manual AI stack</span>
                </div>
                {COMPARE.map(([label, kryx, manual]) => (
                  <div key={label} className="grid grid-cols-[1fr_90px_110px] items-center border-b border-line px-4 py-4 text-sm last:border-b-0 sm:grid-cols-[1fr_130px_150px]">
                    <span className="pr-3 font-semibold text-fg-strong">{label}</span>
                    <span className="inline-flex items-center gap-1.5 font-bold text-accent"><Check className="size-4" /> Yes</span>
                    <span className="text-muted">{manual === false ? <Minus className="size-4" /> : String(manual)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="pricing" className="border-b border-line px-5 py-16 sm:py-24">
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto max-w-3xl text-center">
              <p className="microlabel">Prepaid, not another subscription</p>
              <h2 className="mt-4 text-4xl font-extrabold tracking-[-.045em] text-fg-strong sm:text-6xl">
                Buy work. Not a seat.
              </h2>
              <p className="mx-auto mt-5 max-w-xl text-[16px] leading-7 text-muted">
                100 credits = $1. New accounts start with 100 credits. Purchased credits do not expire.
              </p>
            </div>

            <div className="mx-auto mt-10 grid max-w-4xl gap-3 md:grid-cols-3">
              {pricingPacks.map((pack, index) => (
                <div key={pack.id} className={`rounded-[22px] border p-6 ${index === 1 ? "border-accent bg-accent-wash" : "border-line bg-surface"}`}>
                  <p className="text-xs font-bold uppercase tracking-[.13em] text-faint">{index === 0 ? "Starter" : index === 1 ? "Launch" : "Heavy"}</p>
                  <p className="mt-5 text-4xl font-extrabold tracking-[-.05em] text-fg-strong">${pack.priceUsd}</p>
                  <p className="mt-1 text-sm font-semibold text-accent">{pack.credits.toLocaleString()} credits</p>
                  <p className="mt-5 text-sm leading-6 text-muted">
                    {index === 0 ? "Enough to test real specialist work." : index === 1 ? "The best default for an active launch week." : "For teams running research and pipeline every day."}
                  </p>
                </div>
              ))}
            </div>

            <div className="mx-auto mt-7 flex max-w-4xl flex-col items-center justify-between gap-4 rounded-[18px] border border-line bg-surface-2 px-5 py-4 sm:flex-row">
              <p className="text-sm text-muted">
                Example costs: draft {COST.draft} · web search {COST.web_search} · qualified lead search {COST.lead_search} credits.
              </p>
              <Link href="/pricing" className="inline-flex items-center gap-2 text-sm font-extrabold text-fg-strong">
                See every cost <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        </section>

        <section className="border-b border-line px-5 py-16 sm:py-24">
          <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[.72fr_1.28fr]">
            <div>
              <p className="microlabel">Built in public</p>
              <h2 className="mt-4 text-4xl font-extrabold tracking-[-.045em] text-fg-strong sm:text-5xl">
                No fake logo wall. No invented case study.
              </h2>
            </div>
            <div className="border-t border-line pt-6">
              <p className="max-w-2xl text-xl leading-8 text-fg">
                “I built Kryx because managing five AI chats still leaves the founder doing the management. The product should return work you can inspect, not another dashboard you have to babysit.”
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                <p className="font-extrabold text-fg-strong">{SITE.founder}, founder</p>
                {twitter ? <a href={twitter} target="_blank" rel="noreferrer" className="text-muted underline decoration-line-strong underline-offset-4 hover:text-fg-strong">@{SITE.twitterHandle.replace(/^@/, "")}</a> : null}
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
