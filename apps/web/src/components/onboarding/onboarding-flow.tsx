"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Loader2, Rocket } from "lucide-react";
import { Input } from "@/components/ui/field";
import { AgentAvatar } from "@/components/ui/agent-avatar";
import { HEAD_AGENT, totalAgentCount } from "@/lib/army";
import { cn } from "@/lib/utils";

/**
 * Onboarding that builds the army, instead of interviewing the founder.
 *
 * The version before this asked four questions — what problem do you have, how
 * much are you losing to it, which tools do you pay for — and then dropped the
 * founder on an empty dashboard to start again. That is market research wearing
 * onboarding's clothes: none of the answers made a single agent work, and the
 * founder paid for them with the four screens of friction they hit first.
 *
 * Four fields, and only one of them is thinking: your name, your company and
 * its URL, your X handle, and who you're up against.
 *
 * Notably absent is "who buys it". It is the single most important input in the
 * product — the lead search runs on it — and it is also the question that stops
 * a founder mid-signup to compose a paragraph. So it is not asked. The site is
 * read on the first pipeline run and the customer profile is inferred from it,
 * which is both faster and usually better than what someone types in a hurry.
 * The founder can correct it any time, and the agents say what they inferred
 * rather than pretending it came from the founder.
 *
 * At the end it creates the head agent and the whole team with these answers
 * already filled in, so the first thing the founder sees is their army
 * existing — not a form asking the same things again.
 */

const STEPS = ["You", "Your company", "Your X", "Rivals"] as const;

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
  const [competitors, setCompetitors] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canAdvance =
    (step === 0 && fullName.trim().length > 0) ||
    (step === 1 && website.trim().length > 0) ||
    // X and rivals are both skippable. Neither blocks a single agent from
    // working, and a required field that does nothing is just a toll.
    step === 2 ||
    step === 3;

  async function finish() {
    setPending(true);
    setError(null);
    try {
      // 1. Remember who they are, so the dashboard stops asking.
      await fetch("/api/onboarding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fullName: fullName.trim() }),
      }).catch(() => {
        // Their answers are a nicety; the army below is the point.
      });

      // 2. Create the head agent and every squad under it.
      const created = await fetch("/api/army/deploy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          headName: HEAD_AGENT.defaultName,
          headConfig: {
            morningTime: "09:00",
            eveningTime: "19:00",
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
            businessContext: [company.trim(), website.trim()].filter(Boolean).join(" — "),
            companyName: company.trim(),
            xHandle: xHandle.trim().replace(/^@/, ""),
          },
        }),
      });
      const payload = (await created.json()) as { error?: string };
      if (!created.ok) throw new Error(payload.error ?? "Could not build your army.");

      // 3. Push what they told us onto every agent that can use it.
      await fetch("/api/army/configure", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          websiteUrl: website.trim(),
          companyName: company.trim(),
          xHandle: xHandle.trim().replace(/^@/, ""),
          competitors: competitors.trim(),
        }),
      }).catch(() => {
        // Settings can be filled in per agent; the army exists either way.
      });

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
            title="First — what should we call you?"
            hint={`${HEAD_AGENT.defaultName}, your head agent, talks to you like a colleague. It helps if it knows your name.`}
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
            title="What's your company, and where does it live?"
            hint="Every agent reads the site. It is how they learn what you sell — and who buys it — in your own words, before writing a single line."
          >
            <Input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Company name"
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
          </Question>
        ) : null}

        {step === 2 ? (
          <Question
            title="Your X handle?"
            hint="So the squads can see what you already say publicly, and write in that voice rather than inventing one. Skip it if you'd rather."
          >
            <Input
              value={xHandle}
              onChange={(e) => setXHandle(e.target.value)}
              placeholder="@yourhandle"
              autoFocus
            />
          </Question>
        ) : null}

        {step === 3 ? (
          <Question
            title="Who are you up against?"
            hint="Your watcher reads these every day and tells you the morning one of them changes something. Skip it if you'd rather — you can add them later."
          >
            <Input
              value={competitors}
              onChange={(e) => setCompetitors(e.target.value)}
              placeholder="competitor.com, another.com"
            />

            <div className="mt-5 flex items-center gap-3 rounded-xl border border-line bg-surface p-4">
              <AgentAvatar
                name={HEAD_AGENT.defaultName}
                seed={HEAD_AGENT.id}
                size={40}
                commander
                animated
              />
              <p className="text-sm leading-snug text-muted">
                Next: {HEAD_AGENT.defaultName} and{" "}
                <span className="font-semibold text-fg">
                  {totalAgentCount()} agents
                </span>{" "}
                get created with these answers already filled in.
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
              <ArrowLeft className="size-4" />
              Back
            </button>
          ) : null}

          <div className="ml-auto">
            {step === 3 ? (
              <button
                type="button"
                onClick={finish}
                disabled={pending}
                className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-accent-fg transition-colors hover:bg-accent-hover disabled:opacity-60"
              >
                {pending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Rocket className="size-4" />
                )}
                Build my army
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setStep(step + 1)}
                disabled={!canAdvance}
                className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-accent-fg transition-colors hover:bg-accent-hover disabled:opacity-40"
              >
                Continue
                <ArrowRight className="size-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      <p className="mt-4 text-center text-xs text-faint">
        Four fields, then you&apos;re done. Nothing here is a survey — each
        answer is something your agents actually use.
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
      <h1 className="text-2xl font-extrabold leading-tight text-fg-strong">
        {title}
      </h1>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">{hint}</p>
      <div className="mt-5">{children}</div>
    </div>
  );
}
