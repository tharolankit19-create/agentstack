import Link from "next/link";
import { ArrowRight, Coins, Play, Search, ShieldCheck, SlidersHorizontal, Users } from "lucide-react";
import { FloatingHeader } from "@/components/landing/floating-header";
import { Hero } from "@/components/landing/hero";
import { DemoConsole } from "@/components/landing/demo-console";
import { HowItWorks } from "@/components/landing/how-it-works";
import { TheArmy } from "@/components/landing/the-army";
import { Footer } from "@/components/landing/footer";
import { getSession } from "@/lib/auth";
import { HEAD_AGENT } from "@/lib/army";
import { COST } from "@/lib/credits-public";

export default async function LandingPage() {
  const session = await getSession().catch(() => null);

  return (
    <>
      <FloatingHeader signedIn={Boolean(session)} />
      <main>
        <Hero />

        <section className="px-5 pb-8 pt-1 sm:pb-10">
          <div className="mx-auto grid max-w-5xl gap-3 sm:grid-cols-3">
            {[
              {
                icon: Coins,
                title: "100 free credits",
                body: "Every new account starts with real specialist-work balance. No card required.",
              },
              {
                icon: Users,
                title: "7 specialists + Kryx",
                body: "Research, analytics, content, SEO, conversion, leads and outreach under one head agent.",
              },
              {
                icon: ShieldCheck,
                title: "You keep approval",
                body: "Kryx can prepare the work, but nothing public or outbound ships without your approval.",
              },
            ].map(({ icon: Icon, title, body }) => (
              <div key={title} className="rounded-2xl border border-line bg-surface/80 p-4 shadow-sm">
                <span className="grid size-9 place-items-center rounded-xl bg-surface-2 text-fg-strong">
                  <Icon className="size-4" />
                </span>
                <p className="mt-3 text-sm font-extrabold text-fg-strong">{title}</p>
                <p className="mt-1 text-[13px] leading-5 text-muted">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-y border-line bg-surface/45 px-5 py-14 sm:py-18">
          <div className="mx-auto max-w-5xl">
            <p className="kryx-kicker">Tool routing, without tool setup</p>
            <div className="mt-2 grid gap-5 lg:grid-cols-[.9fr_1.1fr] lg:items-end">
              <div>
                <h2 className="text-3xl font-extrabold tracking-[-.045em] text-fg-strong sm:text-5xl">
                  Tell Kryx the outcome. It chooses the tools.
                </h2>
              </div>
              <p className="max-w-2xl text-[15px] leading-7 text-muted">
                Founders should not have to know which data vendor or endpoint
                belongs behind a task. Kryx decides what live signal is needed,
                rejects routes that are too expensive for unattended work, and
                uses the smallest useful call before the specialist writes.
              </p>
            </div>

            <div className="mt-8 grid gap-3 md:grid-cols-3">
              {[
                {
                  icon: Search,
                  step: "01",
                  title: "Find the right signal",
                  body: "A lead task looks for people data. An SEO task looks for search evidence. A competitor task reads the live market instead of guessing from memory.",
                },
                {
                  icon: SlidersHorizontal,
                  step: "02",
                  title: "Compare before spending",
                  body: "Kryx checks tool fit, health and cost first. Premium enrichment and other expensive calls stay out of background jobs unless you explicitly ask for them.",
                },
                {
                  icon: Play,
                  step: "03",
                  title: "Run only what helps",
                  body: "Result counts stay small, duplicate lookups are avoided, and an empty external-data search does not become a customer credit charge.",
                },
              ].map(({ icon: Icon, step, title, body }) => (
                <div key={title} className="rounded-[22px] border border-line bg-surface p-5">
                  <div className="flex items-center justify-between">
                    <span className="grid size-10 place-items-center rounded-2xl bg-surface-2 text-fg-strong">
                      <Icon className="size-4" />
                    </span>
                    <span className="font-mono text-[11px] font-semibold text-faint">{step}</span>
                  </div>
                  <h3 className="mt-4 text-base font-extrabold text-fg-strong">{title}</h3>
                  <p className="mt-2 text-[13px] leading-6 text-muted">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="demo" className="px-5 pb-16 pt-6 sm:pb-20 sm:pt-10">
          <div className="mx-auto max-w-6xl">
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="kryx-kicker">Interactive product demo</p>
                <h2 className="mt-2 text-3xl font-bold tracking-[-.045em] text-fg-strong sm:text-5xl">
                  Use Kryx before you sign up.
                </h2>
                <p className="mt-3 max-w-2xl text-[15px] leading-7 text-muted sm:text-[16px]">
                  Approve a mission, talk in the room, inspect leads and reset the sample. No video and no fake loading animation.
                </p>
              </div>
              <Link href="/demo" className="inline-flex items-center gap-2 text-sm font-bold text-fg-strong">
                Open full demo <ArrowRight className="size-4" />
              </Link>
            </div>
            <DemoConsole headName={HEAD_AGENT.defaultName} />
          </div>
        </section>

        <TheArmy />

        <HowItWorks />

        <section className="border-b border-line px-5 py-12 sm:py-14">
          <div className="mx-auto max-w-5xl">
            <div className="flex flex-col gap-5 rounded-[24px] border border-line bg-surface-2/70 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <div className="max-w-lg">
                <p className="kryx-kicker">Your first $1 is on us</p>
                <h2 className="mt-2 text-2xl font-extrabold tracking-[-.035em] text-fg-strong sm:text-3xl">
                  100 credits you can actually spend.
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted">
                  No trial clock and no subscription unlock. Sign up, get the
                  balance, and use it on real specialist work.
                </p>
              </div>
              <div className="grid min-w-0 gap-2 sm:min-w-[330px] sm:grid-cols-3">
                {[
                  ["Web search", COST.web_search],
                  ["Lead search", COST.lead_search],
                  ["Morning brief", COST.briefing],
                ].map(([label, amount]) => (
                  <div key={String(label)} className="rounded-2xl border border-line bg-surface p-3">
                    <p className="text-[11px] font-semibold text-muted">{String(label)}</p>
                    <p className="mt-1 text-xl font-extrabold text-fg-strong">{String(amount)}</p>
                    <p className="text-[10px] text-faint">credits</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="pricing" className="border-b border-line px-5 py-16 sm:py-20">
          <div className="mx-auto flex max-w-5xl flex-col gap-7 rounded-[28px] border border-line bg-surface p-7 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-9">
            <div>
              <p className="kryx-kicker">Simple pricing</p>
              <h2 className="mt-2 text-3xl font-bold tracking-[-.04em] text-fg-strong">$0/month.</h2>
              <p className="mt-2 max-w-xl text-[15px] leading-6 text-muted">
                Every new account starts with 100 free credits — $1 of real specialist work. Planning, reviewing and managing Kryx has no monthly seat fee.
              </p>
            </div>
            <Link href="/pricing" className="kryx-button kryx-button-primary h-12 shrink-0 px-5 text-sm">
              See full pricing <ArrowRight className="size-4" />
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
