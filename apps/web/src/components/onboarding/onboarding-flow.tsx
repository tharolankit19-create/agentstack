"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
export function OnboardingFlow({
  defaultName,
}: {
  email: string;
  defaultName: string;
  next: string;
}) {
  const router = useRouter(),
    [name, setName] = useState(defaultName),
    [company, setCompany] = useState(""),
    [website, setWebsite] = useState(""),
    [goal, setGoal] = useState("Find 10 people who may need my product."),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function start() {
    setBusy(true);
    try {
      const setup = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fullName: name,
          company,
          website,
          mainGoal: goal,
        }),
      });
      const saved = await setup.json();
      if (!setup.ok) throw new Error(saved.error);
      const r = await fetch("/api/kryx/goals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          objective: goal,
          context: { company, website },
          budget: 100,
          idempotency_key: crypto.randomUUID(),
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      router.push("/dashboard/tasks/" + data.id);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to start");
      setBusy(false);
    }
  }
  return (
    <section className="op w-full max-w-xl">
      <span>Kryx / First goal</span>
      <h1>What are you building?</h1>
      <p className="op-sub">
        Your website and first growth goal give Kryx somewhere to start.
      </p>
      <div className="op-fields">
        <label>
          Your name
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Company
          <input value={company} onChange={(e) => setCompany(e.target.value)} />
        </label>
        <label>
          Website
          <input
            type="url"
            value={website}
            placeholder="https://your-product.com"
            onChange={(e) => setWebsite(e.target.value)}
          />
        </label>
        <label>
          Main growth goal
          <textarea value={goal} onChange={(e) => setGoal(e.target.value)} />
        </label>
      </div>
      <p className="mb-5">
        <Link href="/dashboard/connectors">Connect apps ↗</Link>
      </p>
      {error && <p role="alert">{error}</p>}
      <button
        disabled={busy || !name || !website || goal.length < 8}
        onClick={start}
      >
        {busy ? "Creating first goal…" : "Give Kryx its first goal →"}
      </button>
    </section>
  );
}
