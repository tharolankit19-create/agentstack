"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  MessageSquare,
  Plus,
  Rocket,
  Settings,
  Sunrise,
  Sunset,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { AgentAvatar } from "@/components/ui/agent-avatar";
import { usePaywall } from "./paywall";
import { HEAD_AGENT, SQUADS, totalAgentCount } from "@/lib/army";
import { getTemplate } from "@/lib/templates";
import type { Agent } from "@/lib/supabase/types";

/**
 * Setup: one question on the screen at a time.
 *
 * The version before this put nine fields on one card — a name, three times, a
 * website, an ICP, an unbounded competitor list — and asked for all of it
 * before anything happened. Every one of those questions is reasonable and the
 * form as a whole was not, because a founder who has just paid wants to see the
 * thing work, and a wall of inputs reads as homework.
 *
 * So: seven steps, one question each, a progress bar, and at the end exactly
 * one button. No branching, no optional side quests, no second call to action
 * competing with the first. The founder's job is to answer and press next
 * until the army is running.
 *
 * The keys are asked for here rather than per agent for the same reason. One
 * model key, once, fanned out across all fourteen — asking fourteen times is
 * how a setup flow becomes an abandonment funnel.
 */

const TIMEZONES = [
  "UTC",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Australia/Sydney",
];

/** The options the head agent template declares, so the two cannot drift. */
function optionsFor(key: string, fallback: string[]): string[] {
  const setting = getTemplate(HEAD_AGENT.id)?.settings.find(
    (entry) => entry.key === key,
  );
  return setting?.options?.length ? setting.options : fallback;
}

type StepId = "name" | "when" | "site" | "who" | "rivals" | "key" | "go";

const STEPS: StepId[] = ["name", "when", "site", "who", "rivals", "key", "go"];

export function CommandCenter({ head }: { head?: Agent }) {
  const router = useRouter();
  const paywall = usePaywall();

  const [index, setIndex] = useState(0);
  const step = STEPS[index];

  const [name, setName] = useState(head?.name || HEAD_AGENT.defaultName);
  const [morning, setMorning] = useState(head?.config?.morningTime || "09:00");
  const [evening, setEvening] = useState(head?.config?.eveningTime || "19:00");
  const [timezone, setTimezone] = useState(
    head?.config?.timezone ||
      (() => {
        // Their real zone if we have a name for it, rather than making a
        // founder in Bengaluru scroll past nine wrong answers to find theirs.
        const guess = Intl.DateTimeFormat().resolvedOptions().timeZone;
        return TIMEZONES.includes(guess) ? guess : "UTC";
      })(),
  );

  const [website, setWebsite] = useState("");
  const [icp, setIcp] = useState("");
  const [competitors, setCompetitors] = useState<string[]>([""]);
  const [modelKey, setModelKey] = useState("");

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const commander = name.trim() || HEAD_AGENT.defaultName;

  /** Whether the current step has an answer good enough to move on. */
  const answered =
    step === "name"
      ? name.trim().length > 0
      : step === "site"
        ? website.trim().length > 0
        : step === "who"
          ? icp.trim().length > 0
          : step === "key"
            ? modelKey.trim().length > 0
            : true;

  async function enlist() {
    setPending(true);
    setError(null);
    try {
      const payload = await paywall.guard<{ created: number; message: string }>(
        () =>
          fetch("/api/army/deploy", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              headName: commander,
              headConfig: {
                morningTime: morning,
                eveningTime: evening,
                timezone,
                businessContext: [website.trim(), icp.trim()]
                  .filter(Boolean)
                  .join(" — "),
              },
            }),
          }),
        "Your army needs a plan",
      );

      // Walled — the modal is up, and that is the whole response.
      if (!payload) {
        setPending(false);
        return;
      }

      // One request, every agent: the shared answers and the one model key.
      await fetch("/api/army/configure", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          websiteUrl: website.trim(),
          icp: icp.trim(),
          competitors: competitors.map((c) => c.trim()).filter(Boolean).join("\n"),
          modelKey: modelKey.trim(),
        }),
      }).catch(() => {
        // The agents exist either way; settings can be filled in per agent.
      });

      setDone(payload.message);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  // ── Already in command ────────────────────────────────────────────────────
  if (head && !done) {
    return (
      <section className="overflow-hidden rounded-2xl border border-line-strong bg-surface-2 shadow-[var(--shadow)]">
        <div className="flex flex-wrap items-center gap-4 p-6">
          <AgentAvatar name={head.name} seed={HEAD_AGENT.id} size={56} commander animated />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-wider text-faint">
              Head agent
            </p>
            <p className="text-xl font-extrabold text-fg-strong">{head.name}</p>
            <p className="mt-0.5 text-sm text-muted">
              Reads what every squad produced and sends you one message.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {/* The direct action a founder actually wants: talk to it. */}
            <Link href={`/dashboard/agents/${head.id}/chat`}>
              <Button size="sm">
                <MessageSquare />
                Chat
              </Button>
            </Link>
            <Link href={`/dashboard/agents/${head.id}`}>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Head agent settings"
                title="Settings"
                className="text-muted hover:text-fg-strong"
              >
                <Settings />
              </Button>
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-2 border-t border-line px-6 py-3 text-sm">
          <span className="flex items-center gap-2 text-muted">
            <Sunrise className="size-4 text-money" aria-hidden />
            Briefing{" "}
            <span className="font-semibold text-fg">
              {head.config?.morningTime ?? "09:00"}
            </span>
          </span>
          <span className="flex items-center gap-2 text-muted">
            <Sunset className="size-4 text-accent" aria-hidden />
            Audit{" "}
            <span className="font-semibold text-fg">
              {head.config?.eveningTime && head.config.eveningTime !== "Off"
                ? head.config.eveningTime
                : "off"}
            </span>
          </span>
          <span className="text-faint">{head.config?.timezone ?? "UTC"}</span>
        </div>
      </section>
    );
  }

  // ── Just enlisted ─────────────────────────────────────────────────────────
  if (done) {
    return (
      <section className="rounded-2xl border border-live/40 bg-[var(--live-wash)] p-6">
        <p className="flex items-center gap-2 text-lg font-extrabold text-fg-strong">
          <Check className="size-5 text-live" aria-hidden />
          {done}
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          One thing left: connect Telegram below so {commander} can reach you.
          Copy the code, send it to the bot, and it starts reporting.
        </p>
      </section>
    );
  }

  // ── The wizard ────────────────────────────────────────────────────────────
  return (
    <section className="overflow-hidden rounded-2xl border-2 border-accent bg-accent/[0.06]">
      {/* Progress. Seven steps stated up front, because a form that will not
          say how long it is reads as one that never ends. */}
      <div className="border-b border-accent/20 px-6 pb-4 pt-5">
        <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider">
          <span className="text-accent">Set up your army</span>
          <span className="text-faint">
            {index + 1} of {STEPS.length}
          </span>
        </div>
        <div className="mt-2.5 flex gap-1.5">
          {STEPS.map((id, i) => (
            <span
              key={id}
              className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                i <= index ? "bg-accent" : "bg-surface-3"
              }`}
            />
          ))}
        </div>
      </div>

      <div className="p-6">
        {step === "name" ? (
          <Question
            title="What do you want to call your head agent?"
            hint={`This is the one you talk to. It reads what all ${totalAgentCount()} agents produced and sends you one message a day. Everyone calls it something — ${HEAD_AGENT.defaultName} is only the default.`}
          >
            <div className="flex items-center gap-4">
              <AgentAvatar name={commander} seed={HEAD_AGENT.id} size={56} commander animated />
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={HEAD_AGENT.defaultName}
                maxLength={40}
                autoFocus
              />
            </div>
          </Question>
        ) : null}

        {step === "when" ? (
          <Question
            title={`When should ${commander} message you?`}
            hint="Your local time. The morning one is a plan; the evening one is a receipt for what actually shipped. Turn the evening off if one a day is enough."
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <Labelled label="Morning briefing">
                <Select
                  value={morning}
                  onChange={setMorning}
                  options={optionsFor("morningTime", ["07:00", "08:00", "09:00", "10:00"])}
                />
              </Labelled>
              <Labelled label="Evening audit">
                <Select
                  value={evening}
                  onChange={setEvening}
                  options={optionsFor("eveningTime", ["Off", "18:00", "19:00", "20:00"])}
                />
              </Labelled>
              <Labelled label="Your timezone">
                <Select value={timezone} onChange={setTimezone} options={TIMEZONES} />
              </Labelled>
            </div>
          </Question>
        ) : null}

        {step === "site" ? (
          <Question
            title="What is your website?"
            hint="Every squad reads it — it is how they learn what you sell, in your own words, before they write a single line."
          >
            <Input
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
              placeholder="https://yourproduct.com"
              inputMode="url"
              autoFocus
            />
          </Question>
        ) : null}

        {step === "who" ? (
          <Question
            title="Who is your customer?"
            hint="Plain English is better than a job title. This is what the outreach squad turns into a real search and what the filter squad uses to say no."
          >
            <Input
              value={icp}
              onChange={(event) => setIcp(event.target.value)}
              placeholder="Dental practice owners, 2–10 chairs, in the UK"
              autoFocus
            />
          </Question>
        ) : null}

        {step === "rivals" ? (
          <Question
            title="Who are you up against?"
            hint="Argus reads these every day and tells you the morning one of them changes something. Skip it if you would rather not — you can add them later."
          >
            <div className="space-y-2">
              {competitors.map((value, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    value={value}
                    onChange={(event) =>
                      setCompetitors((current) =>
                        current.map((c, j) => (j === i ? event.target.value : c)),
                      )
                    }
                    placeholder="https://competitor.com"
                    inputMode="url"
                  />
                  {competitors.length > 1 ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Remove"
                      onClick={() =>
                        setCompetitors((current) => current.filter((_, j) => j !== i))
                      }
                      className="shrink-0 text-muted hover:text-fg"
                    >
                      <X className="size-4" />
                    </Button>
                  ) : null}
                </div>
              ))}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCompetitors((c) => [...c, ""])}
                className="text-muted hover:text-fg-strong"
              >
                <Plus className="size-4" />
                Add another
              </Button>
            </div>
          </Question>
        ) : null}

        {step === "key" ? (
          <Question
            title="Paste one model API key"
            hint="This is the only key you need. It goes to all your agents at once, encrypted, and it is the account the model bills — we never see the invoice and never take a cut. Telegram is on our side; you do not need a bot."
          >
            <Input
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={modelKey}
              onChange={(event) => setModelKey(event.target.value)}
              placeholder="sk-or-v1-…"
              autoFocus
            />
            <p className="mt-3 text-xs leading-relaxed text-faint">
              Works with any OpenAI-compatible endpoint — OpenRouter, OpenAI,
              Groq, Together, NVIDIA NIM. OpenRouter is the cheapest way to
              start, and its free models are enough to see the whole thing run.
            </p>
          </Question>
        ) : null}

        {step === "go" ? (
          <Question
            title={`Deploy ${commander} and the ${totalAgentCount()} agents under it`}
            hint="One button. The head agent is created first and every squad is created underneath it, already reporting."
          >
            <div className="rounded-xl border border-line bg-surface-2 p-4">
              <dl className="space-y-1.5 text-sm">
                <Row label="Head agent" value={commander} />
                <Row
                  label="Messages you"
                  value={`${morning}${evening !== "Off" ? ` and ${evening}` : ""} · ${timezone}`}
                />
                <Row label="Website" value={website.trim() || "—"} />
                <Row label="Customer" value={icp.trim() || "—"} />
                <Row
                  label="Competitors"
                  value={
                    competitors.filter((c) => c.trim()).length > 0
                      ? `${competitors.filter((c) => c.trim()).length} watched`
                      : "none yet"
                  }
                />
                <Row label="Model key" value={modelKey ? "saved, encrypted" : "—"} />
                <Row
                  label="Squads"
                  value={`${SQUADS.length} · ${totalAgentCount()} agents`}
                />
              </dl>
            </div>
          </Question>
        ) : null}

        {error ? (
          <p role="alert" className="mt-4 text-sm font-medium text-danger">
            {error}
          </p>
        ) : null}

        {/* One row, one primary action, always in the same place. */}
        <div className="mt-6 flex items-center gap-3">
          {index > 0 ? (
            <Button
              variant="ghost"
              size="md"
              onClick={() => setIndex((i) => i - 1)}
              disabled={pending}
              className="text-muted hover:text-fg-strong"
            >
              <ArrowLeft />
              Back
            </Button>
          ) : null}

          <div className="ml-auto">
            {step === "go" ? (
              <Button onClick={enlist} disabled={pending} size="md">
                {pending ? <Loader2 className="animate-spin" /> : <Rocket />}
                Deploy my army
              </Button>
            ) : (
              <Button
                onClick={() => setIndex((i) => i + 1)}
                disabled={!answered}
                size="md"
              >
                Next
                <ArrowRight />
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
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
      <h2 className="text-xl font-extrabold leading-tight text-fg-strong sm:text-2xl">
        {title}
      </h2>
      <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-muted">{hint}</p>
      <div className="mt-5">{children}</div>
    </div>
  );
}

function Labelled({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-fg">{label}</span>
      {children}
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-4">
      <dt className="w-32 shrink-0 text-muted">{label}</dt>
      <dd className="min-w-0 flex-1 truncate font-semibold text-fg-strong">{value}</dd>
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="w-full cursor-pointer rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-sm font-medium text-fg outline-none focus:border-accent"
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}
