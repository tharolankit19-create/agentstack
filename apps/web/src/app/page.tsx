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
import { COST } from "@/lib/credits-public";

const COMPARE = [
  ["One person to brief", true, false],
  ["Specialists share context", true, false],
  ["Live evidence attached", true, "manual"],
  ["Approval before outbound work", true, "manual"],
  ["One prepaid balance", true, false],
] as const;

export default async function LandingPage() {
  const session = await getSession().catch(() => null);

  return (
    <>
      <FloatingHeader signedIn={Boolean(session)} />
      <main>
        <Hero />
        <TheArmy />

        <section id="demo" className="border-b border-line px-5 py-16 sm:py-24">
          <div className="mx-auto max-w-6xl">
            <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="microlabel">Try before you sign up</p>
                <h2 className="mt-3 text-4xl font-extrabold tracking-[-.045em] text-fg-strong sm:text-5xl">
                  Click through the actual work loop.
                </h2>
              </div>
              <p className="max-w-md text-sm leading-6 text-muted">
                Open a mission, approve it, ask Kryx a question and inspect a lead. Sample data is labelled.
              </p>
            </div>
            <DemoConsole headName={HEAD_AGENT.defaultName} />
          </div>
        </section>

        <HowItWorks />

        <section id="pricing" className="border-b border-line px-5 py-16 sm:py-24">
          <div className="mx-auto max-w-6xl">
            <p className="microlabel">No subscription</p>
            <h2 className="mt-3 text-4xl font-extrabold tracking-[-.045em] text-fg-strong sm:text-6xl">
              One balance. Pay when Kryx works.
            </h2>
            <p className="mt-4 max-w-2xl text-[15px] leading-7 text-muted">
              Every new account starts with 100 credits. Add more from $5. Purchased credits do not expire.
            </p>

            <div className="mt-9 grid overflow-hidden rounded-[22px] border border-line bg-surface sm:grid-cols-3">
              <div className="p-5 sm:p-6">
                <p className="tnum text-4xl font-extrabold text-accent">100</p>
                <p className="mt-1 font-bold text-fg-strong">free credits</p>
                <p className="mt-2 text-sm leading-6 text-muted">Enough to try real specialist work before you buy.</p>
              </div>
              <div className="border-t border-line p-5 sm:border-l sm:border-t-0 sm:p-6">
                <p className="tnum text-4xl font-extrabold text-fg-strong">$0</p>
                <p className="mt-1 font-bold text-fg-strong">per month</p>
                <p className="mt-2 text-sm leading-6 text-muted">No seat fee. No subscription clock. No auto-renewal.</p>
              </div>
              <div className="border-t border-line p-5 sm:border-l sm:border-t-0 sm:p-6">
                <p className="tnum text-4xl font-extrabold text-fg-strong">$5</p>
                <p className="mt-1 font-bold text-fg-strong">minimum top-up</p>
                <p className="mt-2 text-sm leading-6 text-muted">500 credits in one-time balance.</p>
              </div>
            </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-4">
              {[["Draft", COST.draft], ["Web research", COST.web_search], ["Lead search", COST.lead_search], ["Morning brief", COST.briefing]].map(([label, credits]) => (
                <div key={String(label)} className="flex items-center justify-between rounded-xl border border-line bg-surface px-3 py-3 text-sm">
                  <span className="text-muted">{String(label)}</span>
                  <span className="tnum font-bold text-fg-strong">{String(credits)} cr</span>
                </div>
              ))}
            </div>

            <Link href="/pricing" className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-fg-strong hover:text-accent">
              See every credit cost <ArrowRight className="size-4" />
            </Link>
          </div>
        </section>

        <section className="border-b border-line px-5 py-16 sm:py-24">
          <div className="mx-auto max-w-6xl">
            <p className="microlabel">Why not eight AI chats?</p>
            <h2 className="mt-3 max-w-3xl text-4xl font-extrabold tracking-[-.045em] text-fg-strong sm:text-5xl">
              A team should share the work, not make you manage eight tabs.
            </h2>

            <div className="mt-8 overflow-hidden rounded-[22px] border border-line bg-surface">
              <div className="grid grid-cols-[1fr_96px_110px] border-b border-line bg-surface-2 px-4 py-3 text-xs font-bold text-muted sm:grid-cols-[1fr_140px_160px]">
                <span>What matters</span><span className="text-center text-fg-strong">Kryx</span><span className="text-center">AI chats</span>
              </div>
              {COMPARE.map(([label, kryx, chats]) => (
                <div key={label} className="grid grid-cols-[1fr_96px_110px] items-center border-b border-line px-4 py-3.5 text-sm last:border-0 sm:grid-cols-[1fr_140px_160px]">
                  <span className="font-medium text-fg">{label}</span>
                  <span className="flex justify-center">{kryx ? <Check className="size-4 text-live" /> : <Minus className="size-4 text-faint" />}</span>
                  <span className="text-center text-xs text-muted">{chats === "manual" ? "Manual" : "No"}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
