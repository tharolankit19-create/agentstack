import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, Building2, FileText, MessageSquareText, Search, Star, Users } from "lucide-react";
import { FloatingHeader } from "@/components/landing/floating-header";
import { Hero } from "@/components/landing/hero";
import { DemoConsole } from "@/components/landing/demo-console";
import { HowItWorks } from "@/components/landing/how-it-works";
import { TheArmy } from "@/components/landing/the-army";
import { Footer } from "@/components/landing/footer";
import { getSession } from "@/lib/auth";
import { HEAD_AGENT } from "@/lib/army";
import { COST } from "@/lib/credits-public";
import { SITE, twitterUrl } from "@/lib/site";
import { AgentAvatar } from "@/components/ui/agent-avatar";

const LIVE_SIGNALS = [
  [Search, "Market research", "Current web and news"],
  [Users, "Lead search", "People matched to your ICP"],
  [Building2, "Company data", "Firmographic signals"],
  [MessageSquareText, "Social listening", "Buyer language and demand"],
  [Star, "Review monitoring", "Customer complaints and praise"],
  [BriefcaseBusiness, "Hiring signals", "Teams changing right now"],
  [FileText, "Page reading", "Pricing, copy and product changes"],
] as const;

export default async function LandingPage() {
  const session = await getSession().catch(() => null);
  const twitter = twitterUrl();

  return (
    <>
      <FloatingHeader signedIn={Boolean(session)} />
      <main>
        <Hero />

        <section id="demo" className="border-b border-line px-5 py-16 sm:py-24">
          <div className="mx-auto max-w-6xl">
            <div className="mb-8 grid gap-5 lg:grid-cols-[.72fr_1.28fr] lg:items-end">
              <div><p className="microlabel">The actual product, with sample data</p><h2 className="mt-4 text-4xl sm:text-5xl">Try the work loop yourself.</h2></div>
              <div className="lg:pl-8">
                <p className="max-w-xl text-[16px] leading-7 text-muted">Open a mission, approve it, ask Kryx a question and inspect a lead. Every company, person and result is clearly marked sample data.</p>
                <Link href="/demo" className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-fg-strong">Open the full demo <ArrowRight className="size-4" /></Link>
              </div>
            </div>
            <DemoConsole headName={HEAD_AGENT.defaultName} />
          </div>
        </section>

        <TheArmy />
        <HowItWorks />

        <section className="flex min-h-[82svh] items-center border-b border-line px-5 py-16 sm:py-24">
          <div className="mx-auto w-full max-w-6xl">
            <div className="mx-auto max-w-4xl text-center">
              <p className="text-sm font-semibold text-accent">Live data, not model memory</p>
              <h2 className="mt-4 text-4xl sm:text-6xl">Tell Kryx what to do. It picks the source.</h2>
              <p className="mx-auto mt-4 max-w-2xl text-[16px] leading-7 text-muted">Kryx asks Monid for the best-fit source, checks the price and runs the smallest useful call before a specialist writes.</p>
            </div>

            <div className="mt-10 overflow-hidden rounded-2xl border border-line bg-surface">
              <div className="flex items-center justify-center gap-3 border-b border-line bg-surface-2 px-5 py-4">
                <AgentAvatar name="Kryx" seed="head-agent" commander size={34} />
                <div><p className="text-sm font-bold text-fg-strong">Kryx routing</p><p className="text-xs text-muted">fit → price → live result</p></div>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4">
                {LIVE_SIGNALS.map(([Icon, title, body]) => (
                  <div key={title} className="flex min-h-24 items-center gap-3 border-b border-line p-4 sm:border-r lg:[&:nth-child(4n)]:border-r-0">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-wash text-accent"><Icon className="size-4" /></span>
                    <div><h3 className="text-sm font-bold text-fg-strong">{title}</h3><p className="mt-1 text-xs leading-5 text-muted">{body}</p></div>
                  </div>
                ))}
                <div className="flex min-h-24 items-center justify-center bg-fg-strong p-4 text-center text-bg"><p className="text-sm font-bold">One credit balance.<br/><span className="font-normal opacity-70">No tool setup per agent.</span></p></div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-line px-5 py-16 sm:py-24">
          <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[.72fr_1.28fr]">
            <div><p className="microlabel">Who is building this</p><h2 className="mt-4 text-4xl sm:text-5xl">A founder-built product, in public.</h2></div>
            <div className="border-t border-line pt-6">
              <p className="max-w-2xl font-serif text-2xl italic leading-9 text-fg">“I built Kryx because managing five AI chats still leaves the founder doing the management. The product should return work you can inspect, not another dashboard you have to babysit.”</p>
              <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                <p className="font-bold text-fg-strong">{SITE.founder}, founder</p>
                {twitter ? <a href={twitter} target="_blank" rel="noreferrer" className="text-muted underline decoration-line-strong underline-offset-4 hover:text-fg-strong">@{SITE.twitterHandle.replace(/^@/, "")}</a> : null}
                <Link href="/about" className="text-muted underline decoration-line-strong underline-offset-4 hover:text-fg-strong">Why Kryx exists</Link>
              </div>
              <p className="mt-6 max-w-2xl text-sm leading-6 text-muted">Kryx is early. There is no borrowed logo wall and no invented case study. Use the product demo, read how the system works and judge the receipts.</p>
            </div>
          </div>
        </section>

        <section id="pricing" className="border-b border-line px-5 py-16 sm:py-24">
          <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[.72fr_1.28fr]">
            <div><p className="microlabel">Pay for work, not seats</p><h2 className="mt-4 text-5xl sm:text-6xl">No subscription.</h2><p className="mt-4 max-w-sm text-sm leading-6 text-muted">New accounts get 100 credits once. Add more from $5; purchased credits do not expire.</p></div>
            <div className="border-t border-line">
              {[["Draft or rewrite", COST.draft], ["Web search", COST.web_search], ["Qualified lead search", COST.lead_search], ["Morning brief", COST.briefing]].map(([label, credits]) => (
                <div key={String(label)} className="flex items-center justify-between gap-5 border-b border-line py-4"><p className="text-sm font-semibold text-fg-strong">{String(label)}</p><p className="tnum text-sm text-muted">{String(credits)} credits</p></div>
              ))}
              <div className="flex flex-col gap-5 pt-7 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm leading-6 text-muted">100 credits = $1. Your balance pauses work before it can go negative.</p>
                <Link href="/pricing" className="kryx-button kryx-button-primary h-11 shrink-0 px-5 text-sm">See every cost <ArrowRight className="size-4" /></Link>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
