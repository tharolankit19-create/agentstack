import Link from "next/link";
import { ArrowRight, Coins, ShieldCheck, Users } from "lucide-react";
import { FloatingHeader } from "@/components/landing/floating-header";
import { Hero } from "@/components/landing/hero";
import { DemoConsole } from "@/components/landing/demo-console";
import { HowItWorks } from "@/components/landing/how-it-works";
import { TheArmy } from "@/components/landing/the-army";
import { Footer } from "@/components/landing/footer";
import { getSession } from "@/lib/auth";
import { HEAD_AGENT } from "@/lib/army";

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
