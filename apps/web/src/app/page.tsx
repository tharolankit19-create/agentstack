import Link from "next/link";
import {
  ArrowRight,
  Download,
  FileText,
  Laptop,
  MessageSquareText,
  Search,
  ShieldCheck,
  Workflow,
} from "lucide-react";
import { FloatingHeader } from "@/components/landing/floating-header";
import { Hero } from "@/components/landing/hero";
import { Footer } from "@/components/landing/footer";
import { Faq } from "@/components/landing/faq";
import { getSession } from "@/lib/auth";
import { COST, PACKS } from "@/lib/credits-public";

const PAIN = [
  {
    title: "You are still the router.",
    body: "Ask one AI to research, another to write, copy context into a third tool, then remember what still needs doing.",
  },
  {
    title: "AI gives drafts. You need outcomes.",
    body: "A useful agent should keep moving the job forward, not hand the founder another half-finished document to manage.",
  },
  {
    title: "Automation gets scary fast.",
    body: "The moment an agent can touch your browser or apps, you need clear boundaries, receipts and approvals — not blind autopilot.",
  },
] as const;

const USE_CASES = [
  {
    label: "Morning brief",
    title: "Start the day already caught up.",
    body: "Check analytics, market changes, important conversations and blockers. Kryx returns the few things worth your attention.",
    example: "“What changed overnight that I should care about?”",
  },
  {
    label: "Growth",
    title: "Turn a launch into ongoing distribution.",
    body: "Research conversations, prepare content, find leads, qualify them, update sheets and keep launch work moving.",
    example: "“Promote this launch today and bring me the work to approve.”",
  },
  {
    label: "Founder ops",
    title: "Move work across the tools you already use.",
    body: "Work with docs, inboxes, spreadsheets, browsers and approved desktop or Android apps without rebuilding every workflow as an API integration.",
    example: "“Open the sheet, update the qualified leads and summarize what changed.”",
  },
  {
    label: "Research",
    title: "Get evidence, not confident guesses.",
    body: "Kryx can investigate companies, products, customers, markets and competitors, then bring back sources with the conclusion.",
    example: "“Research these three competitors and tell me what changed this month.”",
  },
  {
    label: "Communication",
    title: "Prepare the reply. Keep the send decision yours.",
    body: "Draft messages, posts and follow-ups from real context. External actions can wait in Needs You until you approve them.",
    example: "“Read the relevant thread and draft the reply I should send.”",
  },
  {
    label: "Recurring work",
    title: "Stop repeating the same founder routine.",
    body: "Schedule research and reporting, or let Observer Mode detect a repeated routine and propose what Kryx could automate safely.",
    example: "“Every weekday, prepare my competitor brief before I start work.”",
  },
] as const;

const PHASES = [
  ["01", "Goal", "Tell Kryx the outcome in plain English. No workflow builder."],
  ["02", "Plan", "Kryx picks the smallest useful set of skills, tools and devices."],
  ["03", "Work", "Independent steps run in parallel where that is safe and useful."],
  ["04", "Needs You", "External or consequential actions stop for your decision."],
  ["05", "Receipt", "Finished work comes back with sources, actions, cost and blockers."],
] as const;

const ARMY = [
  {
    title: "Intelligence",
    body: "Market research, competitor tracking, customer signals, analytics and synthesis.",
    jobs: ["Research", "Analytics", "Competitors", "Customer signals"],
  },
  {
    title: "Growth",
    body: "Content, search, distribution, landing pages and conversion work from real founder context.",
    jobs: ["Content", "SEO / AEO", "Distribution", "Conversion"],
  },
  {
    title: "Pipeline",
    body: "Find the right people, qualify fit, prepare outreach and keep the pipeline organized.",
    jobs: ["Lead research", "Qualification", "Outreach", "CRM work"],
  },
  {
    title: "Founder ops",
    body: "Inbox, docs, meetings, spreadsheets, browser work and approved device actions.",
    jobs: ["Inbox", "Docs", "Meetings", "Files & apps"],
  },
] as const;

const CONTROL = [
  {
    title: "Read",
    body: "Research, inspect public pages, analyze data and prepare drafts can run with low friction.",
    badge: "Automatic",
  },
  {
    title: "Act",
    body: "Sending, publishing and editing external systems can stop in Needs You first.",
    badge: "Ask first",
  },
  {
    title: "Sensitive",
    body: "Payments, destructive deletes, passwords and account-security changes remain blocked or explicitly human-controlled.",
    badge: "Restricted",
  },
] as const;

export default async function LandingPage() {
  const session = await getSession().catch(() => null);
  const pricingPacks = [PACKS[0], PACKS[2], PACKS[3]].filter(Boolean);

  return (
    <>
      <FloatingHeader signedIn={Boolean(session)} />
      <main>
        <Hero />

        <section className="border-b border-line px-5 py-16 sm:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-10 lg:grid-cols-[.78fr_1.22fr] lg:items-start">
              <div className="max-w-xl">
                <p className="microlabel">The actual founder problem</p>
                <h2 className="mt-3 text-4xl font-extrabold tracking-[-.055em] text-fg-strong sm:text-6xl">
                  You do not need another AI tab to manage.
                </h2>
                <p className="mt-5 text-[16px] leading-7 text-muted">
                  Most AI makes the founder responsible for routing, prompting,
                  copying context and checking whether anything actually happened.
                  Kryx is built around the opposite idea: give it responsibility for
                  the job, then step in only when your judgment matters.
                </p>
              </div>

              <div className="overflow-hidden rounded-[24px] border border-line bg-surface">
                {PAIN.map((item, index) => (
                  <div
                    key={item.title}
                    className={\`grid gap-3 p-5 sm:grid-cols-[42px_1fr] sm:p-6 \${index < PAIN.length - 1 ? "border-b border-line" : ""}\`}
                  >
                    <span className="grid size-8 place-items-center rounded-full border border-line bg-surface-2 font-mono text-xs font-bold text-faint">
                      {index + 1}
                    </span>
                    <div>
                      <h3 className="text-xl font-extrabold text-fg-strong">{item.title}</h3>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{item.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="use-cases" className="border-b border-line px-5 py-16 sm:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl">
              <p className="microlabel">What founders hand to Kryx</p>
              <h2 className="mt-3 text-4xl font-extrabold tracking-[-.055em] text-fg-strong sm:text-6xl">
                One agent army for the work around the company.
              </h2>
              <p className="mt-4 max-w-2xl text-[16px] leading-7 text-muted">
                Not twenty agent portraits. Not twenty chats. You talk to Kryx;
                Kryx decides which specialist skills and execution path the job needs.
              </p>
            </div>

            <div className="mt-10 grid overflow-hidden rounded-[24px] border border-line md:grid-cols-2 lg:grid-cols-3">
              {USE_CASES.map((item, index) => (
                <article
                  key={item.label}
                  className={\`min-h-[260px] p-6 sm:p-7 \${index % 3 !== 2 ? "lg:border-r lg:border-line" : ""} \${index < 3 ? "border-b border-line" : ""}\`}
                >
                  <p className="text-xs font-bold uppercase tracking-[.1em] text-faint">{item.label}</p>
                  <h3 className="mt-8 text-2xl font-extrabold text-fg-strong">{item.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-muted">{item.body}</p>
                  <p className="mt-5 border-t border-line pt-4 text-sm font-semibold leading-6 text-fg-strong">
                    {item.example}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="how" className="border-b border-line px-5 py-16 sm:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-3xl text-center">
              <p className="microlabel">Five phases, one conversation</p>
              <h2 className="mt-3 text-4xl font-extrabold tracking-[-.055em] text-fg-strong sm:text-6xl">
                From “do this” to finished work.
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-[16px] leading-7 text-muted">
                Kryx keeps the machinery behind the scenes. You see the plan,
                real progress, decisions that need you, and the final receipt.
              </p>
            </div>

            <div className="mt-10 overflow-hidden rounded-[24px] border border-line bg-surface">
              {PHASES.map(([num, title, body], index) => (
                <div
                  key={num}
                  className={\`grid gap-4 px-5 py-5 sm:grid-cols-[70px_180px_1fr] sm:items-center sm:px-7 \${index < PHASES.length - 1 ? "border-b border-line" : ""}\`}
                >
                  <span className="font-mono text-xs font-extrabold text-accent">{num}</span>
                  <h3 className="text-lg font-extrabold text-fg-strong">{title}</h3>
                  <p className="text-sm leading-6 text-muted">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-line px-5 py-16 sm:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-10 lg:grid-cols-[.72fr_1.28fr] lg:items-start">
              <div className="max-w-xl">
                <p className="microlabel">The army is capability, not characters</p>
                <h2 className="mt-3 text-4xl font-extrabold tracking-[-.055em] text-fg-strong sm:text-6xl">
                  Specialists appear when the job needs them.
                </h2>
                <p className="mt-4 text-[16px] leading-7 text-muted">
                  The founder should never have to decide which bot to open.
                  Kryx assembles the useful skills behind one mission and returns
                  one coherent outcome.
                </p>
              </div>

              <div className="grid overflow-hidden rounded-[24px] border border-line md:grid-cols-2">
                {ARMY.map((group, index) => (
                  <article
                    key={group.title}
                    className={\`p-6 sm:p-7 \${index % 2 === 0 ? "md:border-r md:border-line" : ""} \${index < 2 ? "border-b border-line" : ""}\`}
                  >
                    <h3 className="text-2xl font-extrabold text-fg-strong">{group.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted">{group.body}</p>
                    <div className="mt-5 flex flex-wrap gap-2">
                      {group.jobs.map((job) => (
                        <span
                          key={job}
                          className="rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-xs font-semibold text-muted"
                        >
                          {job}
                        </span>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="control" className="border-b border-line px-5 py-16 sm:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl">
              <p className="microlabel">Works where the work already lives</p>
              <h2 className="mt-3 text-4xl font-extrabold tracking-[-.055em] text-fg-strong sm:text-6xl">
                Cloud when possible. Your device when necessary.
              </h2>
              <p className="mt-4 max-w-2xl text-[16px] leading-7 text-muted">
                Kryx can research in the cloud, use your real signed-in browser,
                and run approved local work on Mac, Windows, Linux or Android.
                The execution method is part of the plan — not something you wire by hand.
              </p>
            </div>

            <div className="mt-10 grid overflow-hidden rounded-[24px] border border-line md:grid-cols-4">
              {[
                ["Cloud", Search, "Planning, research, model work and public web tasks."],
                ["Browser", MessageSquareText, "Use the browser session you are already signed into."],
                ["Device", Laptop, "Approved local app, file and accessibility-driven work."],
                ["Tools", Workflow, "Use structured APIs and tools when they are the safer path."],
              ].map(([title, Icon, body], index) => {
                const IconComponent = Icon as typeof Search;
                return (
                  <div
                    key={String(title)}
                    className={\`p-6 sm:p-7 \${index < 3 ? "border-b border-line md:border-b-0 md:border-r" : ""}\`}
                  >
                    <IconComponent className="size-5 text-accent" />
                    <h3 className="mt-8 text-xl font-extrabold text-fg-strong">{String(title)}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted">{String(body)}</p>
                  </div>
                );
              })}
            </div>

            <div className="mt-8 grid gap-4 lg:grid-cols-[.82fr_1.18fr]">
              <div className="rounded-[24px] border border-line bg-surface p-6 sm:p-7">
                <ShieldCheck className="size-5 text-accent" />
                <h3 className="mt-8 text-2xl font-extrabold text-fg-strong">
                  Autonomy that starts conservative.
                </h3>
                <p className="mt-3 text-sm leading-6 text-muted">
                  You can loosen a rule after you trust a workflow. Kryx should never
                  silently increase its own permissions.
                </p>
              </div>

              <div className="overflow-hidden rounded-[24px] border border-line bg-surface">
                {CONTROL.map((item, index) => (
                  <div
                    key={item.title}
                    className={\`grid gap-4 p-5 sm:grid-cols-[110px_1fr_auto] sm:items-center sm:p-6 \${index < CONTROL.length - 1 ? "border-b border-line" : ""}\`}
                  >
                    <h3 className="font-extrabold text-fg-strong">{item.title}</h3>
                    <p className="text-sm leading-6 text-muted">{item.body}</p>
                    <span className="w-fit rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-xs font-bold text-fg-strong">
                      {item.badge}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-line px-5 py-16 sm:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-10 lg:grid-cols-[.8fr_1.2fr] lg:items-center">
              <div>
                <p className="microlabel">Persistent, not forgetful</p>
                <h2 className="mt-3 text-4xl font-extrabold tracking-[-.055em] text-fg-strong sm:text-6xl">
                  Kryx gets better at working with you.
                </h2>
                <p className="mt-4 max-w-xl text-[16px] leading-7 text-muted">
                  Workspace memory keeps the facts that make future work useful:
                  product, ICP, tone, approved claims, rejected language, campaign
                  outcomes and the rules you set for your devices.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ["Your company", "Products, positioning, pricing, competitors and workspace context."],
                  ["Your taste", "Voice, corrections, rejected phrases and patterns you keep choosing."],
                  ["Your rules", "Allowed apps, approval policies, exclusions and autonomy per workflow."],
                  ["Your outcomes", "What performed, what failed, what was approved and what should not repeat."],
                ].map(([title, body]) => (
                  <div key={title} className="rounded-[20px] border border-line bg-surface p-5">
                    <h3 className="font-extrabold text-fg-strong">{title}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted">{body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="docs" className="border-b border-line px-5 py-16 sm:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="overflow-hidden rounded-[28px] border border-line bg-surface">
              <div className="grid lg:grid-cols-[.8fr_1.2fr]">
                <div className="border-b border-line p-6 sm:p-8 lg:border-b-0 lg:border-r">
                  <FileText className="size-5 text-accent" />
                  <p className="mt-8 microlabel">Docs that explain the product</p>
                  <h2 className="mt-3 text-4xl font-extrabold tracking-[-.05em] text-fg-strong sm:text-5xl">
                    Know exactly what Kryx can do before you trust it.
                  </h2>
                  <p className="mt-4 text-sm leading-6 text-muted">
                    Quickstart, missions, devices, approvals, credits, Observer Mode,
                    scheduling and privacy — written for founders, not infrastructure teams.
                  </p>
                  <Link
                    href="/docs"
                    className="mt-6 inline-flex items-center gap-2 text-sm font-extrabold text-fg-strong hover:text-accent"
                  >
                    Read the docs <ArrowRight className="size-4" />
                  </Link>
                </div>

                <div className="grid sm:grid-cols-2">
                  {[
                    ["01", "Start in five minutes", "Create your workspace, give Kryx one real job, review the receipt."],
                    ["02", "Connect a device", "Use the same account on Android, Mac, Windows or Linux."],
                    ["03", "Set boundaries", "Choose what runs automatically and what always waits for you."],
                    ["04", "Make it recurring", "Schedule work or turn a repeated routine into a proposed automation."],
                  ].map(([num, title, body], index) => (
                    <div
                      key={num}
                      className={\`p-6 sm:p-7 \${index % 2 === 0 ? "sm:border-r sm:border-line" : ""} \${index < 2 ? "border-b border-line" : ""}\`}
                    >
                      <span className="font-mono text-xs font-bold text-accent">{num}</span>
                      <h3 className="mt-8 text-xl font-extrabold text-fg-strong">{title}</h3>
                      <p className="mt-2 text-sm leading-6 text-muted">{body}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="pricing" className="border-b border-line px-5 py-16 sm:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-3xl text-center">
              <p className="microlabel">Pay for work, not another seat</p>
              <h2 className="mt-3 text-4xl font-extrabold tracking-[-.055em] text-fg-strong sm:text-6xl">
                Start small. Spend when Kryx actually works.
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-[16px] leading-7 text-muted">
                New accounts start with 100 credits. Credits are consumed by
                billable model/tool work; local clicks do not exist just to burn your balance.
              </p>
            </div>

            <div className="mx-auto mt-10 grid max-w-4xl gap-3 md:grid-cols-3">
              {pricingPacks.map((pack, index) => (
                <div
                  key={pack.id}
                  className={\`rounded-[22px] border p-6 \${index === 1 ? "border-accent bg-accent-wash" : "border-line bg-surface"}\`}
                >
                  <p className="text-xs font-bold uppercase tracking-[.1em] text-faint">
                    {index === 0 ? "Try it" : index === 1 ? "Founder" : "Heavy use"}
                  </p>
                  <p className="mt-4 text-4xl font-extrabold tracking-[-.05em] text-fg-strong">
                    {"$"}{pack.priceUsd}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-accent">
                    {pack.credits.toLocaleString()} credits
                  </p>
                </div>
              ))}
            </div>

            <div className="mx-auto mt-6 flex max-w-4xl flex-col items-center justify-between gap-3 rounded-[18px] border border-line bg-surface-2 px-5 py-4 sm:flex-row">
              <p className="text-sm text-muted">
                Example costs: draft {COST.draft} · web search {COST.web_search} · lead search {COST.lead_search} credits.
              </p>
              <Link
                href="/pricing"
                className="inline-flex items-center gap-2 text-sm font-extrabold text-fg-strong hover:text-accent"
              >
                See every cost <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        </section>

        <Faq />

        <section className="px-5 py-16 sm:py-24">
          <div className="mx-auto max-w-7xl overflow-hidden rounded-[28px] border border-line bg-fg-strong px-6 py-10 text-bg sm:px-10 sm:py-14">
            <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
              <div>
                <p className="text-sm font-semibold opacity-65">Stop managing your AI.</p>
                <h2 className="mt-3 max-w-4xl text-4xl font-extrabold leading-[.98] tracking-[-.055em] text-bg sm:text-6xl">
                  Give Kryx the job. Come back to the work.
                </h2>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                <Link
                  href="/login?mode=signup"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-accent-cta px-5 text-sm font-extrabold text-accent-cta-fg"
                >
                  Start free <ArrowRight className="size-4" />
                </Link>
                <Link
                  href="/download"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-white/15 px-5 text-sm font-extrabold text-bg"
                >
                  <Download className="size-4" /> Download
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
