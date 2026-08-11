"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plus, Settings, Sunrise, Sunset, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { AgentAvatar } from "@/components/ui/agent-avatar";
import { usePaywall } from "./paywall";
import { HEAD_AGENT, SQUADS, totalAgentCount } from "@/lib/army";
import { getTemplate } from "@/lib/templates";
import type { Agent } from "@/lib/supabase/types";

/**
 * The head agent comes first, and everything else comes with it.
 *
 * The old version of this screen handed a new customer a grid of fourteen
 * cards and let them pick. That is a catalogue, and a catalogue is something
 * you browse once — nobody configures fourteen agents one at a time, so people
 * configured two and left.
 *
 * So there is one decision on this screen: what your head agent is called and
 * when it messages you. Answer it and the squads are created behind it,
 * already reporting to it. The founder never has to think about the other
 * thirteen unless they want to.
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

/** The options the head agent template actually declares, so the two cannot drift. */
function optionsFor(key: string, fallback: string[]): string[] {
  const template = getTemplate(HEAD_AGENT.id);
  const setting = template?.settings.find((entry) => entry.key === key);
  return setting?.options?.length ? setting.options : fallback;
}

export function CommandCenter({ head }: { head?: Agent }) {
  const router = useRouter();
  const paywall = usePaywall();

  const [name, setName] = useState(head?.name || HEAD_AGENT.defaultName);
  const [morning, setMorning] = useState(head?.config?.morningTime || "09:00");
  const [evening, setEvening] = useState(head?.config?.eveningTime || "19:00");
  const [timezone, setTimezone] = useState(
    head?.config?.timezone ||
      // Their real zone if we have a name for it, rather than making a founder
      // in Bengaluru scroll past nine wrong answers to find theirs.
      (() => {
        const guess = Intl.DateTimeFormat().resolvedOptions().timeZone;
        return TIMEZONES.includes(guess) ? guess : "UTC";
      })(),
  );

  const [website, setWebsite] = useState("");
  const [icp, setIcp] = useState("");
  const [competitors, setCompetitors] = useState<string[]>([""]);

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const total = totalAgentCount() + 1;

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
              headName: name.trim() || HEAD_AGENT.defaultName,
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

      // Push the shared answers onto every squad agent that declares them.
      const config = {
        websiteUrl: website.trim(),
        icp: icp.trim(),
        competitors: competitors.map((c) => c.trim()).filter(Boolean).join("\n"),
      };

      if (Object.values(config).some(Boolean)) {
        await fetch("/api/army/configure", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(config),
        }).catch(() => {
          // The agents exist either way; settings can be filled in per agent.
        });
      }

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
      <section className="overflow-hidden rounded-2xl border border-line bg-surface-2">
        <div className="flex flex-wrap items-center gap-4 p-6">
          <AgentAvatar name={head.name} seed={HEAD_AGENT.id} size={52} commander />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-wider text-faint">
              Head agent
            </p>
            <p className="text-xl font-extrabold text-fg-strong">{head.name}</p>
            <p className="mt-0.5 text-sm text-muted">
              Reads what every squad produced and sends you one message.
            </p>
          </div>
          <Link href={`/dashboard/agents/${head.id}`} className="shrink-0">
            <Button variant="darkOutline" size="sm">
              <Settings />
              Configure
            </Button>
          </Link>
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
        <p className="mt-1.5 text-sm text-muted">
          Connect Telegram below so {name} can reach you, then deploy the squads
          when you are ready. Nothing runs, publishes or sends until you say so.
        </p>
      </section>
    );
  }

  // ── Nothing yet: the one form that starts the whole thing ──────────────────
  return (
    <section className="overflow-hidden rounded-2xl border-2 border-accent bg-accent/[0.07]">
      <div className="border-b border-accent/25 p-6">
        <p className="text-xs font-bold uppercase tracking-wider text-accent">
          Step one of one
        </p>
        <h2 className="mt-2 text-2xl font-extrabold text-fg-strong">
          Meet your head agent
        </h2>
        <p className="mt-1.5 max-w-xl text-[15px] leading-relaxed text-muted">
          You will only ever talk to this one. It reads what the {SQUADS.length}{" "}
          squads produced, decides what actually matters, and messages you twice
          a day. Name it, tell it when to report, and the other{" "}
          {totalAgentCount()} agents are created underneath it.
        </p>
      </div>

      <div className="p-6">
        <div className="flex flex-wrap items-end gap-4">
          <AgentAvatar
            name={name || HEAD_AGENT.defaultName}
            seed={HEAD_AGENT.id}
            size={56}
            commander
          />
          <Field label="What do you want to call it?" className="min-w-[14rem] flex-1">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={HEAD_AGENT.defaultName}
              maxLength={40}
            />
          </Field>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Field label="Morning briefing">
            <Select
              value={morning}
              onChange={setMorning}
              options={optionsFor("morningTime", ["07:00", "08:00", "09:00", "10:00"])}
            />
          </Field>
          <Field label="Evening audit">
            <Select
              value={evening}
              onChange={setEvening}
              options={optionsFor("eveningTime", ["Off", "18:00", "19:00", "20:00"])}
            />
          </Field>
          <Field label="Your timezone">
            <Select value={timezone} onChange={setTimezone} options={TIMEZONES} />
          </Field>
        </div>

        <div className="mt-6 border-t border-accent/20 pt-6">
          <p className="text-sm font-bold text-fg-strong">
            What the squads need to know
          </p>
          <p className="mt-1 text-sm text-muted">
            Answered once, sent to all of them. Changeable per agent afterwards.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Your website" required>
              <Input
                value={website}
                onChange={(event) => setWebsite(event.target.value)}
                placeholder="https://yourproduct.com"
                inputMode="url"
              />
            </Field>
            <Field label="Who is your customer?" required>
              <Input
                value={icp}
                onChange={(event) => setIcp(event.target.value)}
                placeholder="Dental practice owners, 2–10 chairs"
              />
            </Field>
          </div>

          <div className="mt-4">
            <p className="text-sm font-medium text-fg">
              Competitors{" "}
              <span className="font-normal text-faint">— as many as you like</span>
            </p>
            <div className="mt-2 space-y-2">
              {competitors.map((value, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={value}
                    onChange={(event) =>
                      setCompetitors((current) =>
                        current.map((c, i) => (i === index ? event.target.value : c)),
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
                        setCompetitors((current) => current.filter((_, i) => i !== index))
                      }
                      className="shrink-0 text-muted hover:text-fg"
                    >
                      <X className="size-4" />
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCompetitors((c) => [...c, ""])}
              className="mt-2 text-muted hover:text-fg-strong"
            >
              <Plus className="size-4" />
              Add another
            </Button>
          </div>
        </div>

        {error ? (
          <p role="alert" className="mt-4 text-sm font-medium text-danger">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button
            onClick={enlist}
            disabled={pending || !website.trim() || !icp.trim()}
            size="md"
          >
            {pending ? <Loader2 className="animate-spin" /> : null}
            Create {name.trim() || HEAD_AGENT.defaultName} and the {total - 1} agents
            under it
          </Button>
          <p className="text-xs text-muted">
            They arrive as drafts. Nothing runs until you deploy it.
          </p>
        </div>
      </div>
    </section>
  );
}

function Field({
  label,
  required,
  className = "",
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-sm font-medium text-fg">
        {label}
        {required ? <span className="ml-1 text-money">*</span> : null}
      </span>
      {children}
    </label>
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
