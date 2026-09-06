import Link from "next/link";
import { PLAN_LIST } from "@/lib/plans";
import { PlanButton } from "./plan-button";

export function Pricing({ signedIn = false }: { signedIn?: boolean }) {
  return <section id="pricing" className="border-b border-line px-5 py-20">
    <div className="mx-auto max-w-5xl">
      <p className="text-sm font-bold text-accent">SET UP FREE. SEE THE WORK. THEN DECIDE.</p>
      <h2 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">Your first three mornings are on us.</h2>
      <p className="mt-5 max-w-2xl text-lg text-muted">Give your army a real assignment. Review the leads, research and drafts it delivers before choosing a subscription.</p>
      <div className="mt-10 grid gap-5 md:grid-cols-2">
        {PLAN_LIST.map(plan => <article key={plan.tier} className={`flex flex-col rounded-2xl border p-7 ${plan.highlight ? "border-accent bg-accent-wash" : "border-line bg-surface"}`}>
          <h3 className="text-xl font-bold">{plan.name}</h3>
          <p className="mt-4 text-5xl font-bold">${plan.priceUsd}<span className="text-base font-normal text-muted"> / month</span></p>
          <p className="mt-3 text-base text-muted">{plan.tagline}</p>
          <ul className="my-6 flex-1 space-y-3 text-base">{plan.features.slice(0, 5).map(f => <li key={f}>✓ {f}</li>)}</ul>
          <PlanButton plan={plan.tier} signedIn={signedIn}>{plan.cta}</PlanButton>
          <p className="mt-3 text-sm text-muted">No card for the trial. No automatic charge.</p>
        </article>)}
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line p-5">
        <div><h3 className="font-bold">Free observer · $0</h3><p className="mt-1 text-sm text-muted">Set up your business, explore the army, and keep your workspace. Start a trial when you want agents to work.</p></div>
        <Link href={signedIn ? "/dashboard" : "/login?mode=signup"} className="shrink-0 rounded-lg border border-line px-4 py-3 text-sm font-bold">Explore for free</Link>
      </div>
    </div>
  </section>;
}
