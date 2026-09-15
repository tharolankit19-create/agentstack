import Link from "next/link";
import { ArrowRight } from "lucide-react";
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

const ROUTING_STEPS = [
  ["Find the right signal", "Lead work asks for people data. SEO work asks for search evidence. Competitor work reads the live market."],
  ["Check fit and cost", "Kryx compares the available routes before it spends, and keeps expensive enrichment out of unattended work."],
  ["Run the smallest useful call", "Result counts stay focused, duplicate lookups are avoided, and an empty external-data search is not charged."],
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

        <section className="border-b border-line px-5 py-16 sm:py-24">
          <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[.72fr_1.28fr]">
            <div>
              <p className="microlabel">Tool routing</p>
              <h2 className="mt-4 text-4xl sm:text-5xl">Ask for the outcome. Kryx chooses the source.</h2>
              <p className="mt-4 max-w-sm text-sm leading-6 text-muted">You should not need to know which research or data API belongs behind a task.</p>
            </div>
            <div className="border-t border-line">
              {ROUTING_STEPS.map(([title, body], index) => (
                <div key={title} className="grid gap-3 border-b border-line py-5 sm:grid-cols-[42px_190px_1fr]">
                  <span className="tnum text-xs text-faint">0{index + 1}</span>
                  <h3 className="text-sm font-bold text-fg-strong">{title}</h3>
                  <p className="text-sm leading-6 text-muted">{body}</p>
                </div>
              ))}
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
            <div><p className="microlabel">Simple usage pricing</p><h2 className="mt-4 text-5xl sm:text-6xl">$0 <span className="text-2xl text-muted">/ month</span></h2><p className="mt-4 max-w-sm text-sm leading-6 text-muted">Start with 100 credits. Add more from $5. Purchased credits do not expire.</p></div>
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
