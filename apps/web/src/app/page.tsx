import Link from "next/link";
import { OperatorHome } from "@/components/operator/workspace";
import { SIGNUP_CREDITS, MIN_TOPUP_USD } from "@/lib/credits-public";
export default function Page() {
  const sections = [
    [
      "One goal → a plan",
      "Kryx turns your outcome into tasks with dependencies. Review the plan before execution starts. Independent work can run in parallel.",
    ],
    [
      "Kryx works in the background",
      "Research, qualification, drafts and reports run through a persistent queue. The task records completed steps, errors and evidence. Close the tab and return to the same work.",
    ],
    [
      "Its own computer",
      "A workspace browser keeps its profile and working files. Desktop and mobile captures become evidence alongside the page content. Browser access follows domain permissions.",
    ],
    [
      "Specialists without management",
      "Kryx delegates research, lead qualification, content and analysis with structured objectives and evidence. You manage the goal.",
    ],
    [
      "Finished work you can inspect",
      "Open source-backed lead lists, outreach drafts, conversion audits and reports. Download the files and follow the sources behind them.",
    ],
    [
      "You control external actions",
      "Read and draft work proceeds automatically. Email sending asks for approval by default. Review the recipient and exact message before it leaves your workspace.",
    ],
    [
      "A playbook for your business",
      "Typed memory keeps your business, audience and style context together. Save a successful workflow as a Skill and run it again. Live facts are checked when they matter.",
    ],
    [
      "Work that repeats",
      "Routines create persistent tasks at the time you choose. Competitor monitoring compares previous evidence and flags material changes. No change means no alert.",
    ],
    [
      "Use the apps you already own",
      "Connect encrypted model keys, Firecrawl and Resend through the integrations screen. Your own supported provider keys are used first. Existing tools and legacy workers remain available.",
    ],
    [
      "Built around founder outcomes",
      "Prepare a launch. Find prospects. Audit a landing page. Draft a content week. Track competitor pricing. Start with the work you need finished.",
    ],
  ];
  return (
    <main className="op-landing">
      <nav>
        <Link href="/" className="text-xl font-semibold">
          KryxAI
        </Link>
        <div>
          <Link href="#work">Watch it work</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/login">Sign in</Link>
        </div>
      </nav>
      <section className="op-hero">
        <p className="text-sm">KryxAI</p>
        <h1>
          Your always-on
          <br />
          AI marketing operator.
        </h1>
        <p>
          Tell Kryx the outcome. It plans the work, uses your apps and browser,
          keeps working in the background, and brings you finished work.
        </p>
        <Link className="op-cta" href="/login?mode=signup">
          Give Kryx a goal →
        </Link>
        <p className="!text-xs">
          Research. Drafts. Evidence. Decisions that need you.
        </p>
      </section>
      <section id="work" className="rounded-xl border border-line p-5 sm:p-9">
        <OperatorHome publicView />
        <p className="mt-6 text-xs text-muted">
          This is the product workspace. Sign in to run a goal and see your
          actual execution history.
        </p>
      </section>
      {sections.map(([title, text]) => (
        <section className="op-feature" key={title}>
          <h2>{title}</h2>
          <p>{text}</p>
        </section>
      ))}
      <section className="op-feature" id="pricing">
        <h2>Pay for delegated work.</h2>
        <div>
          <p>
            Start with {SIGNUP_CREDITS} signup credits. Add usage from $
            {MIN_TOPUP_USD}. The task shows its spend and stops at your budget.
          </p>
          <Link href="/pricing" className="op-cta mt-5">
            See pricing →
          </Link>
        </div>
      </section>
      <section className="op-feature">
        <h2>Before you start</h2>
        <div>
          {[
            [
              "Does Kryx send outreach automatically?",
              "It prepares drafts. Sending needs your approval unless you explicitly set an allow rule.",
            ],
            [
              "Will closing the tab stop a task?",
              "No. Tasks and checkpoints live in the database. A configured server scheduler advances the queue.",
            ],
            [
              "What if a provider fails?",
              "The failure appears in Activity. Safe work retries with a limit; exhausted work needs review. Uncertain email delivery stays visible for provider reconciliation.",
            ],
            [
              "Is Kryx affiliated with OpenAI?",
              "No. KryxAI is an independent product.",
            ],
          ].map(([q, a]) => (
            <details className="py-4 border-b border-line" key={q}>
              <summary className="cursor-pointer font-medium">{q}</summary>
              <p className="mt-3">{a}</p>
            </details>
          ))}
        </div>
      </section>
      <footer className="flex justify-between">
        <span>KryxAI · Come back to finished work.</span>
        <Link href="/privacy">Privacy</Link>
      </footer>
    </main>
  );
}
