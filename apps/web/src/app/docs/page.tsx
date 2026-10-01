import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  CreditCard,
  Download,
  Eye,
  Laptop,
  LockKeyhole,
  ShieldCheck,
  Workflow,
} from "lucide-react";
import { FloatingHeader } from "@/components/landing/floating-header";
import { Footer } from "@/components/landing/footer";
import { getSession } from "@/lib/auth";

const NAV = [
  ["quickstart", "Quickstart"],
  ["missions", "Missions"],
  ["devices", "Devices"],
  ["approvals", "Approvals"],
  ["credits", "Credits"],
  ["observer", "Observer Mode"],
  ["scheduling", "Scheduling"],
  ["privacy", "Privacy"],
] as const;

export default async function DocsPage() {
  const session = await getSession().catch(() => null);

  return (
    <>
      <FloatingHeader signedIn={Boolean(session)} />
      <main className="px-5 pb-20 pt-28 sm:pt-32">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="microlabel">Kryx docs</p>
            <h1 className="mt-4 text-5xl font-extrabold tracking-[-.06em] text-fg-strong sm:text-7xl">
              Delegate without guessing what the agent can do.
            </h1>
            <p className="mt-5 max-w-2xl text-[17px] leading-8 text-muted">
              The founder&apos;s guide to missions, devices, approvals, credits,
              recurring work and the boundaries Kryx keeps around your accounts.
            </p>
          </div>

          <div className="mt-12 grid gap-10 lg:grid-cols-[220px_1fr]">
            <aside className="lg:sticky lg:top-24 lg:h-fit">
              <nav className="rounded-[18px] border border-line bg-surface p-2">
                {NAV.map(([href, label]) => (
                  <a
                    key={href}
                    href={`#${href}`}
                    className="block rounded-xl px-3 py-2.5 text-sm font-semibold text-muted transition hover:bg-surface-2 hover:text-fg-strong"
                  >
                    {label}
                  </a>
                ))}
              </nav>

              <div className="mt-3 rounded-[18px] border border-line bg-surface p-4">
                <p className="text-sm font-extrabold text-fg-strong">Ready to try it?</p>
                <p className="mt-1 text-xs leading-5 text-muted">
                  New accounts start with 100 credits.
                </p>
                <Link
                  href="/login?mode=signup"
                  className="mt-4 inline-flex items-center gap-2 text-sm font-extrabold text-accent"
                >
                  Start free <ArrowRight className="size-4" />
                </Link>
              </div>
            </aside>

            <div className="space-y-6">
              <section id="quickstart" className="scroll-mt-28 rounded-[24px] border border-line bg-surface p-6 sm:p-8">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="size-5 text-accent" />
                  <p className="microlabel">Quickstart</p>
                </div>
                <h2 className="mt-5 text-3xl font-extrabold text-fg-strong sm:text-4xl">
                  Your first useful mission in five minutes.
                </h2>
                <ol className="mt-6 space-y-4">
                  {[
                    ["Create your workspace", "Tell Kryx what you are building, the product URL and the context that matters."],
                    ["Give it one real job", "Use a concrete outcome: research three competitors, prepare today’s content, or find ten qualified leads."],
                    ["Read the plan", "Kryx shows what it intends to do and whether a device or account permission is required."],
                    ["Let it work", "The mission moves through real states. A missing login or blocked action becomes a visible blocker."],
                    ["Review the receipt", "Finished work includes the result, evidence, actions taken and credits used."],
                  ].map(([title, body], index) => (
                    <li key={title} className="grid gap-3 sm:grid-cols-[32px_1fr]">
                      <span className="grid size-7 place-items-center rounded-full border border-line bg-surface-2 font-mono text-[11px] font-bold text-faint">
                        {index + 1}
                      </span>
                      <div>
                        <p className="font-extrabold text-fg-strong">{title}</p>
                        <p className="mt-1 text-sm leading-6 text-muted">{body}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>

              <section id="missions" className="scroll-mt-28 rounded-[24px] border border-line bg-surface p-6 sm:p-8">
                <div className="flex items-center gap-3">
                  <Workflow className="size-5 text-accent" />
                  <p className="microlabel">Missions</p>
                </div>
                <h2 className="mt-5 text-3xl font-extrabold text-fg-strong sm:text-4xl">
                  One goal can coordinate several specialist skills.
                </h2>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-muted">
                  You do not manually wire a workflow. Kryx breaks the goal into
                  the smallest useful steps, chooses cloud or device execution and
                  keeps the work inside one mission.
                </p>
                <div className="mt-6 grid gap-3 md:grid-cols-3">
                  {[
                    ["queued → running", "The mission is waiting for capacity or actively executing."],
                    ["waiting_for_user", "A login, approval or clarification is blocking safe progress."],
                    ["completed / failed", "Kryx only marks completed after the expected work actually happened."],
                  ].map(([title, body]) => (
                    <div key={title} className="rounded-xl border border-line bg-surface-2 p-4">
                      <p className="font-mono text-xs font-bold text-accent">{title}</p>
                      <p className="mt-2 text-sm leading-6 text-muted">{body}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section id="devices" className="scroll-mt-28 rounded-[24px] border border-line bg-surface p-6 sm:p-8">
                <div className="flex items-center gap-3">
                  <Laptop className="size-5 text-accent" />
                  <p className="microlabel">Devices</p>
                </div>
                <h2 className="mt-5 text-3xl font-extrabold text-fg-strong sm:text-4xl">
                  Same Kryx account. Different execution surfaces.
                </h2>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-muted">
                  Mac, Windows, Linux and Android register as devices under the
                  same account. Kryx uses a device when the job depends on local
                  files, an approved native app or a browser session you are already signed into.
                </p>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  {[
                    ["Cloud", "Best for public research, planning and model/tool work."],
                    ["Browser", "Best for signed-in web apps when structured browser access is enough."],
                    ["Desktop", "Best for approved local files and native app context."],
                    ["Android", "Best for approved app work through Android Accessibility on the device."],
                  ].map(([title, body]) => (
                    <div key={title} className="rounded-xl border border-line bg-surface-2 p-4">
                      <p className="font-extrabold text-fg-strong">{title}</p>
                      <p className="mt-2 text-sm leading-6 text-muted">{body}</p>
                    </div>
                  ))}
                </div>
                <Link
                  href="/download"
                  className="mt-6 inline-flex items-center gap-2 text-sm font-extrabold text-fg-strong hover:text-accent"
                >
                  <Download className="size-4" /> Download Kryx
                </Link>
              </section>

              <section id="approvals" className="scroll-mt-28 rounded-[24px] border border-line bg-surface p-6 sm:p-8">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="size-5 text-accent" />
                  <p className="microlabel">Approvals</p>
                </div>
                <h2 className="mt-5 text-3xl font-extrabold text-fg-strong sm:text-4xl">
                  “Always allow” should be narrow, not a blank cheque.
                </h2>
                <div className="mt-6 overflow-hidden rounded-xl border border-line">
                  {[
                    ["Read / research", "Can be automatic when it stays inside the allowed context."],
                    ["Open an app", "Ask once by default. You can allow that specific app for future missions."],
                    ["Send / publish / edit", "Separate approval policy from simply opening the app."],
                    ["Payments / destructive / account security", "Remain restricted or explicitly human-controlled."],
                  ].map(([title, body], index) => (
                    <div
                      key={title}
                      className={`grid gap-2 p-4 sm:grid-cols-[190px_1fr] ${index < 3 ? "border-b border-line" : ""}`}
                    >
                      <p className="font-extrabold text-fg-strong">{title}</p>
                      <p className="text-sm leading-6 text-muted">{body}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section id="credits" className="scroll-mt-28 rounded-[24px] border border-line bg-surface p-6 sm:p-8">
                <div className="flex items-center gap-3">
                  <CreditCard className="size-5 text-accent" />
                  <p className="microlabel">Credits</p>
                </div>
                <h2 className="mt-5 text-3xl font-extrabold text-fg-strong sm:text-4xl">
                  Pay for model/tool work, not mouse movement.
                </h2>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-muted">
                  Kryx uses the existing prepaid credit balance. Billable model
                  calls and tools consume credits; local clicks and navigation are
                  not invented as a separate token meter. Estimated credits appear
                  before a mission and actual usage belongs in the final receipt.
                </p>
              </section>

              <section id="observer" className="scroll-mt-28 rounded-[24px] border border-line bg-surface p-6 sm:p-8">
                <div className="flex items-center gap-3">
                  <Eye className="size-5 text-accent" />
                  <p className="microlabel">Observer Mode</p>
                </div>
                <h2 className="mt-5 text-3xl font-extrabold text-fg-strong sm:text-4xl">
                  Let Kryx notice repetition without keylogging your life.
                </h2>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-muted">
                  Observer Mode is optional and only watches apps you allow. Kryx
                  captures structured workflow metadata where possible, not passwords
                  or private text streams. When it notices a repeated routine, it
                  proposes the automation instead of silently taking over.
                </p>
              </section>

              <section id="scheduling" className="scroll-mt-28 rounded-[24px] border border-line bg-surface p-6 sm:p-8">
                <div className="flex items-center gap-3">
                  <Clock3 className="size-5 text-accent" />
                  <p className="microlabel">Scheduling</p>
                </div>
                <h2 className="mt-5 text-3xl font-extrabold text-fg-strong sm:text-4xl">
                  Give recurring work a cadence.
                </h2>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-muted">
                  “Every morning research five competitors.” “Every Friday prepare
                  my growth report.” Device-dependent work waits for the selected
                  device to be available; cloud-safe work can continue without it.
                </p>
              </section>

              <section id="privacy" className="scroll-mt-28 rounded-[24px] border border-line bg-surface p-6 sm:p-8">
                <div className="flex items-center gap-3">
                  <LockKeyhole className="size-5 text-accent" />
                  <p className="microlabel">Privacy</p>
                </div>
                <h2 className="mt-5 text-3xl font-extrabold text-fg-strong sm:text-4xl">
                  Local sessions stay local unless the job truly needs context.
                </h2>
                <ul className="mt-6 space-y-3 text-sm leading-6 text-muted">
                  {[
                    "Kryx does not ask for or store your Google password.",
                    "Browser cookies and raw credential stores are not copied to the cloud.",
                    "External webpage/app text is treated as untrusted data, not instructions.",
                    "Password fields, OTPs and sensitive account-security actions stay out of ordinary device automation.",
                    "You can revoke a device and cut off its short-lived credentials from your account.",
                  ].map((item) => (
                    <li key={item} className="flex gap-3">
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
