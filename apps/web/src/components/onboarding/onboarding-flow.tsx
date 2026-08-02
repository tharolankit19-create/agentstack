"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { PROBLEMS, SPEND_BANDS } from "@/lib/onboarding";
import { TEMPLATES, formatUsd } from "@/lib/templates";
import { cn } from "@/lib/utils";

/**
 * Four questions, one screen each.
 *
 * Kept to four because every extra step loses people, and every one of these
 * four is used afterwards: the name greets them, the problems order their
 * library, the spend sets the anchor on their dashboard, and the tools become
 * the agents we suggest first. Nothing is asked for a database column's sake.
 *
 * The tools step is skippable and says so, because a required optional
 * question is just a required question that annoys people.
 */

const TOOL_OPTIONS = [
  ...new Set(TEMPLATES.flatMap((template) => template.replaces.tools)),
].sort();

const STEPS = ["You", "The problem", "The damage", "Your tools"] as const;

export function OnboardingFlow({
  email,
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
  const [problems, setProblems] = useState<string[]>([]);
  const [spendBand, setSpendBand] = useState("");
  const [tools, setTools] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // What their answers already imply, shown back to them on the last step.
  const impliedSavings = useMemo(
    () =>
      TEMPLATES.filter((template) =>
        template.replaces.tools.some((tool) => tools.includes(tool)),
      ).reduce((sum, template) => sum + template.replaces.monthlyUsd, 0),
    [tools],
  );

  const canAdvance =
    (step === 0 && fullName.trim().length > 0) ||
    (step === 1 && problems.length > 0) ||
    (step === 2 && spendBand.length > 0) ||
    step === 3;

  async function finish() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          company: company.trim() || undefined,
          problems,
          spendBand,
          tools,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Could not save that.");

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
                index <= step ? "bg-[var(--color-accent)]" : "bg-white/10",
              )}
            />
            <p
              className={cn(
                "mt-2 text-xs transition-colors",
                index === step ? "font-semibold text-zinc-300" : "text-zinc-600",
              )}
            >
              {label}
            </p>
          </div>
        ))}
      </div>

      <div key={step} className="animate-in-up">
        {step === 0 ? (
          <>
            <h1 className="text-3xl font-extrabold text-white">
              First — what should we call you?
            </h1>
            <p className="mt-2 text-[15px] text-zinc-400">
              Signed in as {email}.
            </p>

            <div className="mt-7 space-y-4">
              <Input
                autoFocus
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Your name"
                aria-label="Your name"
                onKeyDown={(event) => {
                  if (event.key === "Enter" && canAdvance) setStep(1);
                }}
              />
              <Input
                value={company}
                onChange={(event) => setCompany(event.target.value)}
                placeholder="Company (optional)"
                aria-label="Company"
              />
            </div>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <h1 className="text-3xl font-extrabold text-white">
              What made you look for this?
            </h1>
            <p className="mt-2 text-[15px] text-zinc-400">
              Pick everything that is true. It decides which agents we put in
              front of you first.
            </p>

            <div className="mt-7 space-y-2">
              {PROBLEMS.map((problem) => (
                <Choice
                  key={problem.id}
                  selected={problems.includes(problem.id)}
                  onClick={() =>
                    setProblems((current) =>
                      current.includes(problem.id)
                        ? current.filter((id) => id !== problem.id)
                        : [...current, problem.id],
                    )
                  }
                >
                  {problem.label}
                </Choice>
              ))}
            </div>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <h1 className="text-3xl font-extrabold text-white">
              Roughly what do you spend on software each month?
            </h1>
            <p className="mt-2 text-[15px] text-zinc-400">
              A guess is fine. Nobody knows this number exactly, which is part of
              the problem.
            </p>

            <div className="mt-7 space-y-2">
              {SPEND_BANDS.map((band) => (
                <Choice
                  key={band.id}
                  selected={spendBand === band.id}
                  onClick={() => setSpendBand(band.id)}
                >
                  {band.label}
                </Choice>
              ))}
            </div>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <h1 className="text-3xl font-extrabold text-white">
              Which of these do you pay for?
            </h1>
            <p className="mt-2 text-[15px] text-zinc-400">
              Optional — skip it if you would rather. We use it to show you the
              agents that replace what you already have.
            </p>

            <div className="mt-7 flex flex-wrap gap-2">
              {TOOL_OPTIONS.map((tool) => (
                <button
                  key={tool}
                  type="button"
                  aria-pressed={tools.includes(tool)}
                  onClick={() =>
                    setTools((current) =>
                      current.includes(tool)
                        ? current.filter((t) => t !== tool)
                        : [...current, tool],
                    )
                  }
                  className={cn(
                    "rounded-full border px-3.5 py-2 text-sm font-medium transition-all",
                    tools.includes(tool)
                      ? "border-[var(--color-accent)] bg-[var(--color-accent)]/15 text-white"
                      : "border-[var(--color-surface-line)] text-zinc-400 hover:border-zinc-600 hover:text-zinc-200",
                  )}
                >
                  {tool}
                </button>
              ))}
            </div>

            {impliedSavings > 0 ? (
              <p className="animate-in-up mt-6 rounded-xl border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 p-4 text-[15px] leading-relaxed text-white">
                Those cost about{" "}
                <span className="font-bold">{formatUsd(impliedSavings)}/month</span>{" "}
                at list price. We have an agent for every one of them.
              </p>
            ) : null}
          </>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="mt-5 text-sm font-medium text-red-400">
          {error}
        </p>
      ) : null}

      <div className="mt-9 flex items-center gap-3">
        {step > 0 ? (
          <Button
            variant="ghost"
            size="md"
            onClick={() => setStep(step - 1)}
            className="text-zinc-400 hover:bg-white/5 hover:text-white"
          >
            <ArrowLeft />
            Back
          </Button>
        ) : null}

        <div className="ml-auto flex items-center gap-3">
          {step === 3 ? (
            <button
              type="button"
              onClick={finish}
              disabled={pending}
              className="text-sm text-zinc-500 underline transition-colors hover:text-zinc-300"
            >
              Skip this
            </button>
          ) : null}

          <Button
            size="md"
            disabled={!canAdvance || pending}
            onClick={() => (step === 3 ? finish() : setStep(step + 1))}
          >
            {pending ? <Loader2 className="animate-spin" /> : null}
            {step === 3 ? "Open my dashboard" : "Continue"}
            {pending ? null : <ArrowRight />}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Choice({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border p-4 text-left text-[15px] transition-all",
        selected
          ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-white"
          : "border-[var(--color-surface-line)] text-zinc-300 hover:border-zinc-600",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "grid size-5 shrink-0 place-items-center rounded-md border transition-all",
          selected
            ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-white"
            : "border-[var(--color-surface-line)]",
        )}
      >
        {selected ? <Check className="size-3.5" strokeWidth={3} /> : null}
      </span>
      {children}
    </button>
  );
}
