"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/field";
import { PLAN_LIST } from "@/lib/plans";

export function OnboardingFlow({ defaultName, next }: { email: string; defaultName: string; next: string }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(defaultName);
  const [company, setCompany] = useState("");
  const [website, setWebsite] = useState("");
  const [icp, setIcp] = useState("");
  const [competitors, setCompetitors] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState("");
  async function finish(plan: "none" | "starter" | "pro") {
    if (pending) return;
    setPending(plan); setError("");
    try {
      const response = await fetch("/api/onboarding", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ fullName: name.trim(), company: company.trim(),
          config: { websiteUrl: website.trim().startsWith("https://") || website.trim().startsWith("http://") ? website.trim() : `https://${website.trim()}`,
            companyName: company.trim(), icp: icp.trim(), competitors: competitors.trim(),
            morningTime: "08:00", eveningTime: "19:00",
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC" } }),
      });
      const saved = await response.json();
      if (!response.ok) throw new Error(saved.error || "Could not save your setup.");
      if (plan !== "none") {
        const trial = await fetch("/api/trial", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ plan }) });
        const result = await trial.json();
        if (!trial.ok) throw new Error(result.error || "Could not start the trial. Your setup is saved.");
      }
      router.push(next); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Please retry."); setPending(null); }
  }
  return <div className="w-full max-w-2xl">
    <p className="mb-3 text-sm text-muted">Step {step + 1} of 2</p>
    <div className="rounded-2xl border border-line bg-surface p-6 sm:p-8">
      {step === 0 ? <form onSubmit={e => { e.preventDefault(); setStep(1); }} className="space-y-5">
        <h1 className="text-3xl font-bold">Give your army its first brief.</h1>
        <p className="text-base text-muted">Your site and ideal customer guide every lead search, research task and draft.</p>
        <label className="block text-sm">Your name<Input required value={name} onChange={e => setName(e.target.value)} autoComplete="name" /></label>
        <label className="block text-sm">Company<Input value={company} onChange={e => setCompany(e.target.value)} autoComplete="organization" /></label>
        <label className="block text-sm">Website<Input required value={website} onChange={e => setWebsite(e.target.value)} placeholder="yourcompany.com" /></label>
        <label className="block text-sm">Who should we find as customers?<Input required value={icp} onChange={e => setIcp(e.target.value)} placeholder="For example: SaaS founders in the US with 5–50 employees" /></label>
        <label className="block text-sm">Competitor websites · optional<Input value={competitors} onChange={e => setCompetitors(e.target.value)} placeholder="competitor.com, another.com" /></label>
        <button className="w-full rounded-xl bg-accent px-5 py-3 font-bold text-accent-fg">Continue</button>
      </form> : <div>
        <h1 className="text-3xl font-bold">Let your army work for 3 days.</h1>
        <p className="mt-3 text-base text-muted">No card required. Your trial starts only when you choose a plan below.</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">{PLAN_LIST.map(plan => <button disabled={!!pending} key={plan.tier} onClick={() => finish(plan.tier as "starter" | "pro")} className="rounded-xl border border-line p-5 text-left hover:border-accent disabled:opacity-50">
          <p className="font-bold">{plan.name} · ${plan.priceUsd}/month</p>
          <p className="mt-2 text-sm text-muted">{plan.tagline}</p>
          <p className="mt-4 font-bold text-accent">{pending === plan.tier ? "Setting up…" : "Start 3-day free trial"}</p>
        </button>)}</div>
        <button disabled={!!pending} onClick={() => finish("none")} className="mt-5 w-full rounded-xl border border-line px-5 py-3 text-sm">{pending === "none" ? "Saving setup…" : "Continue free · observe and set up"}</button>
        <p className="mt-3 text-sm text-muted">Free accounts can explore. Chat and work require an active trial or subscription.</p>
        <button disabled={!!pending} onClick={() => setStep(0)} className="mt-5 text-sm underline">Back to my brief</button>
      </div>}
      {error && <p role="alert" className="mt-4 text-sm text-danger">{error}</p>}
    </div>
  </div>;
}
