"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Loader2, Rocket } from "lucide-react";
import { Input } from "@/components/ui/field";
import { AgentAvatar } from "@/components/ui/agent-avatar";
import { HEAD_AGENT, totalAgentCount } from "@/lib/army";
import { cn } from "@/lib/utils";

/**
 * Two-screen onboarding.
 *
 * Do not make a founder configure an AI org chart. We need only enough to do a
 * useful first run: who they are, what company/site to learn, and optionally
 * their public X voice. ICP, competitors, channels and tactics are work for the
 * army to discover and propose; the founder can correct them later.
 */
const STEPS = ["You", "Business"] as const;

export function OnboardingFlow({
  defaultName,
  next,
}: {
  email: string;
  defaultName: string;
  next: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [fullName, setFullName] = useState(defaultName);
  const [company, setCompany] = useState("");
  const [website, setWebsite] = useState("");
  const [xHandle, setXHandle] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canAdvance = step === 0 ? fullName.trim().length > 0 : website.trim().length > 0;

  async function finish() {
    setPending(true);
    setError(null);
    try {
      await fetch("/api/onboarding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fullName: fullName.trim() }),
      }).catch(() => undefined);

      const sharedConfig = {
        morningTime: "09:00",
        eveningTime: "19:00",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        businessContext: [company.trim(), website.trim()].filter(Boolean).join(" — "),
        companyName: company.trim(),
        websiteUrl: website.trim(),
        xHandle: xHandle.trim().replace(/^@/, ""),
      };

      const created = await fetch("/api/army/deploy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          headName: HEAD_AGENT.defaultName,
          headConfig: sharedConfig,
        }),
      });
      const payload = (await created.json()) as { error?: string };
      if (!created.ok) throw new Error(payload.error ?? "Could not build your army.");

      await fetch("/api/army/configure", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          websiteUrl: website.trim(),
          twitterHandle: xHandle.trim().replace(/^@/, ""),
        }),
      }).catch(() => undefined);

      router.push(next);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong.");
      setPending(false);
    }
  }

  return (
    <div className="w-full max-w-lg">
      <div className="mb-8 flex gap-1.5">
        {STEPS.map((label, index) => (
          <div key={label} className="flex-1">
            <div
              className={cn(
                "h-1 rounded-full transition-colors duration-500",
                index <= step ? "bg-accent" : "bg-surface-3",
              )}
            />
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-line-strong bg-surface-2 p-6 shadow-[var(--shadow)] sm:p-8">
        {step === 0 ? (
          <Question
            title="What should the team call you?"
            hint={`${HEAD_AGENT.defaultName} talks to you like a teammate, not a dashboard.`}
          >
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your name"
              autoFocus
            />
          </Question>
        ) : null}

        {step === 1 ? (
          <Question
            title="Give the team your business."
            hint="Your site is enough to start. The research agent will find the market and competitors; you can correct anything later."
          >
            <Input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Company name (optional)"
              autoFocus
            />
            <div className="mt-3">
              <Input
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://yourproduct.com"
                inputMode="url"
              />
            </div>
            <div className="mt-3">
              <Input
                value={xHandle}
                onChange={(e) => setXHandle(e.target.value)}
                placeholder="@yourhandle (optional, helps learn your voice)"
              />
            </div>

            <div className="mt-5 flex items-center gap-3 rounded-xl border border-line bg-surface p-4">
              <AgentAvatar
                name={HEAD_AGENT.defaultName}
                seed={HEAD_AGENT.id}
                size={40}
                commander
                animated
              />
              <p className="text-sm leading-snug text-muted">
                Next: {HEAD_AGENT.defaultName} +{" "}
                <span className="font-semibold text-fg">{totalAgentCount()} specialists</span>{" "}
                are created already connected to the same business context.
              </p>
            </div>
          </Question>
        ) : null}

        {error ? (
          <p role="alert" className="mt-4 text-sm font-medium text-danger">
            {error}
          </p>
        ) : null}

        <div className="mt-7 flex items-center gap-3">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:text-fg-strong"
            >
              <ArrowLeft className="size-4" /> Back
            </button>
          ) : null}

          <div className="ml-auto">
            {step === STEPS.length - 1 ? (
              <button
                type="button"
                onClick={finish}
                disabled={pending || !canAdvance}
                className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-accent-fg transition-colors hover:bg-accent-hover disabled:opacity-60"
              >
                {pending ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />}
                Build my army
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setStep(step + 1)}
                disabled={!canAdvance}
                className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-accent-fg transition-colors hover:bg-accent-hover disabled:opacity-40"
              >
                Continue <ArrowRight className="size-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      <p className="mt-4 text-center text-xs text-faint">
        Two screens. No model picker, no agent configuration, no marketing questionnaire.
      </p>
    </div>
  );
}

function Question({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="animate-in-up">
      <h1 className="text-2xl font-extrabold leading-tight text-fg-strong">{title}</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">{hint}</p>
      <div className="mt-5">{children}</div>
    </div>
  );
}
