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

const ROUTE = [
  ["01", "Understand the goal", "Kryx turns one plain-English outcome into specialist jobs."],
  ["02", "Pick the right route", "The agent uses the cheapest healthy live source that can return useful evidence."],
  ["03", "Return work, not chatter", "Research, drafts and receipts come back together. Consequential actions wait for approval."],
] as const;

const COMPARE = [
  ["One goal coordinates the team", true, false],
  ["Named specialists with persistent roles", true, false],
  ["Live data routing when the task needs it", true, "manual"],
  ["Scheduled recurring work", true, "extra setup"],
  ["One approval queue", true, "manual"],
  ["Prepaid credits; no monthly subscription", true, false],
] as const;

export default async function LandingPage() {
  const session = await getSession().catch(() => null);
  const pricingPacks = [PACKS[0], PACKS[2], PACKS[3]].filter(Boolean);

  return (
    <>
      <FloatingHeader signedIn={Boolean(session)} />
      <main>
        <Hero />

        <section id="demo" className="border-b border-line px-5 py-16 sm:py-20 lg:min-h-[86svh] lg:flex lg:items-center">
          <div className="mx-auto w-full max-w-7xl">
            <div className="mb-7 grid gap-4 lg:grid-cols-[.72fr_1.28fr] lg:items-end">
              <div>
                <p className="microlabel">See the product first</p>
                <h2 className="mt-3 text-4xl font-extrabold tracking-[-.05em] text-fg-strong sm:text-6xl">
                  Click through a real work loop.
                </h2>
              </div>
              <div className="lg:pl-8">
                <p className="max-w-xl text-[15px] leading-7 text-muted">
                  Open a mission, approve it, ask Kryx a question and inspect a lead. The demo is clearly labeled sample data.
                </p>
                <Link href="/demo" className="mt-3 inline-flex items-center gap-2 text-sm font-extrabold text-fg-strong hover:text-accent">
                  Open the full demo <ArrowRight className="size-4" />
                </Link>
              </div>
            </div>
            <DemoConsole headName={HEAD_AGENT.defaultName} />
          </div>
        </section>

        <TheArmy />

        <section className="border-b border-line px-5 py-16 sm:py-20 lg:min-h-[78svh] lg:flex lg:items-center">
          <div className="mx-auto w-full max-w-7xl">
            <div className="mx-auto max-w-4xl text-center">
              <p className="microlabel">How Kryx chooses the work path</p>
              <h2 className="mt-3 text-4xl font-extrabold tracking-[-.05em] text-fg-strong sm:text-6xl">
                Tell it what to do. Kryx picks the route.
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-7 text-muted">
                You do not choose providers, prompts or APIs for every task. The system routes the job and keeps a receipt.
              </p>
            </div>

            <div className="mx-auto mt-9 grid max-w-5xl overflow-hidden rounded-[22px] border border-line md:grid-cols-3">
              {ROUTE.map(([num, title, body], index) => (
                <div key={num} className={`p-6 sm:p-7 ${index < ROUTE.length - 1 ? "border-b border-line md:border-b-0 md:border-r" : ""}`}>
                  <p className="font-mono text-xs font-bold text-accent">{num}</p>
                  <h3 className="mt-8 text-xl font-extrabold text-fg-strong">{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-muted">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <HowItWorks />

        <section className="border-b border-line px-5 py-16 sm:py-20">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[.72fr_1.28fr] lg:items-start">
            <div>
              <p className="microlabel">Why switch</p>
              <h2 className="mt-3 text-4xl font-extrabold tracking-[-.05em] text-fg-strong sm:text-5xl">
                Kryx vs. managing an AI stack yourself.
              </h2>
              <p className="mt-4 max-w-sm text-sm leading-6 text-muted">
                The model is not the product. Coordination, evidence, memory and approval are.
              </p>
            </div>

            <div className="overflow-hidden rounded-[22px] border border-line bg-surface">
              <div className="grid grid-cols-[1fr_90px_110px] border-b border-line bg-surface-2 px-4 py-3 text-xs font-bold text-faint sm:grid-cols-[1fr_130px_150px]">
                <span>Capability</span><span>KryxAI</span><span>Manual stack</span>
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
        </section>

        <section id="pricing" className="border-b border-line px-5 py-16 sm:py-20 lg:min-h-[78svh] lg:flex lg:items-center">
          <div className="mx-auto w-full max-w-7xl">
            <div className="mx-auto max-w-3xl text-center">
              <p className="microlabel">Prepaid, not another subscription</p>
              <h2 className="mt-3 text-4xl font-extrabold tracking-[-.05em] text-fg-strong sm:text-6xl">
                Buy work. Not a seat.
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-[15px] leading-7 text-muted">
                100 credits = $1. New accounts start with 100 credits. Purchased credits do not expire.
              </p>
            </div>

            <div className="mx-auto mt-9 grid max-w-4xl gap-3 md:grid-cols-3">
              {pricingPacks.map((pack, index) => (
                <div key={pack.id} className={`rounded-[22px] border p-6 ${index === 1 ? "border-accent bg-accent-wash" : "border-line bg-surface"}`}>
                  <p className="text-xs font-bold uppercase tracking-[.12em] text-faint">
                    {index === 0 ? "Good" : index === 1 ? "Better" : "Best"}
                  </p>
                  <p className="mt-4 text-4xl font-extrabold tracking-[-.05em] text-fg-strong">${pack.priceUsd}</p>
                  <p className="mt-1 text-sm font-semibold text-accent">{pack.credits.toLocaleString()} credits</p>
                  <p className="mt-4 text-sm leading-6 text-muted">
                    {index === 0 ? "Test real specialist work." : index === 1 ? "A strong default for an active launch." : "For founders running research and pipeline every day."}
                  </p>
                </div>
              ))}
            </div>

            <div className="mx-auto mt-6 flex max-w-4xl flex-col items-center justify-between gap-3 rounded-[18px] border border-line bg-surface-2 px-5 py-4 sm:flex-row">
              <p className="text-sm text-muted">
                Example costs: draft {COST.draft} · web search {COST.web_search} · lead search {COST.lead_search} credits.
              </p>
              <Link href="/pricing" className="inline-flex items-center gap-2 text-sm font-extrabold text-fg-strong hover:text-accent">
                See every cost <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
