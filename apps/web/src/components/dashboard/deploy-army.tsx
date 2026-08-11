"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plus, Rocket, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { usePaywall } from "./paywall";
import { HEAD_AGENT, SQUADS } from "@/lib/army";

/**
 * One click, the whole army.
 *
 * Fourteen agents configured one card at a time is why people stop at two, so
 * this asks for the handful of things every squad needs — the site, the
 * profile, the competitors — and creates all of them at once.
 *
 * The fields are the ones that are genuinely shared. Anything only one agent
 * needs stays on that agent's own page, because a setup form that asks for
 * everything up front is the other way to lose people.
 *
 * Competitors are unbounded on purpose: the intel squad gets better with more
 * of them and there is no reason to cap a list of strings.
 */
export function DeployArmy({ alreadyHave }: { alreadyHave: number }) {
  const router = useRouter();
  const paywall = usePaywall();

  const [open, setOpen] = useState(false);
  const [website, setWebsite] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [twitter, setTwitter] = useState("");
  const [icp, setIcp] = useState("");
  const [competitors, setCompetitors] = useState<string[]>([""]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const total = SQUADS.reduce((sum, squad) => sum + squad.pipeline.length, 0) + 1;
  const missing = Math.max(total - alreadyHave, 0);

  async function deploy() {
    setPending(true);
    setError(null);
    try {
      const payload = await paywall.guard<{
        created: number;
        message: string;
        createdIds?: string[];
      }>(
        () => fetch("/api/army/deploy", { method: "POST" }),
        "Deploying your army needs a plan",
      );

      // Walled — the modal is up, and that is the whole response.
      if (!payload) {
        setPending(false);
        return;
      }

      // Push the shared setup onto every agent that was just created.
      const config = {
        websiteUrl: website.trim(),
        linkedinUrl: linkedin.trim(),
        twitterHandle: twitter.trim(),
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

  if (done) {
    return (
      <div className="rounded-2xl border border-live/40 bg-[var(--live-wash)] p-6">
        <p className="flex items-center gap-2 font-bold text-fg-strong">
          <Check className="size-5 text-live" aria-hidden />
          {done}
        </p>
        <p className="mt-1.5 text-sm text-muted">
          Open any agent to check its settings, then hit Deploy on the ones you
          want live first.
        </p>
      </div>
    );
  }

  if (missing === 0) {
    return null;
  }

  return (
    <div className="overflow-hidden rounded-2xl border-2 border-accent bg-accent/[0.07]">
      <div className="flex flex-wrap items-center gap-4 p-6">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent text-xl text-accent-fg">
          {HEAD_AGENT.icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-extrabold text-fg-strong">
            Deploy your whole army
          </p>
          <p className="mt-0.5 text-sm text-muted">
            {missing} agents across {SQUADS.length} squads, plus the head agent
            that reports to you. One click, one form.
          </p>
        </div>
        <Button onClick={() => setOpen((v) => !v)} className="shrink-0">
          {open ? <X /> : <Rocket />}
          {open ? "Close" : "Set it up"}
        </Button>
      </div>

      {open ? (
        <div className="animate-in-up border-t border-accent/25 p-6">
          <p className="text-sm font-bold text-fg-strong">
            What every squad needs to know
          </p>
          <p className="mt-1 text-sm text-muted">
            Fill this once and it goes to all of them. You can change any of it
            per agent afterwards.
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Field label="Your website" required>
              <Input
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://yourproduct.com"
                inputMode="url"
              />
            </Field>
            <Field label="Your LinkedIn profile">
              <Input
                value={linkedin}
                onChange={(e) => setLinkedin(e.target.value)}
                placeholder="https://linkedin.com/in/you"
                inputMode="url"
              />
            </Field>
            <Field label="Your X handle">
              <Input
                value={twitter}
                onChange={(e) => setTwitter(e.target.value)}
                placeholder="@yourhandle"
              />
            </Field>
            <Field label="Who is your customer?" required>
              <Input
                value={icp}
                onChange={(e) => setIcp(e.target.value)}
                placeholder="Dental practice owners, 2–10 chairs"
              />
            </Field>
          </div>

          <div className="mt-5">
            <p className="text-sm font-semibold text-fg">
              Competitors{" "}
              <span className="font-normal text-faint">
                — as many as you like
              </span>
            </p>
            <div className="mt-2 space-y-2">
              {competitors.map((value, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={value}
                    onChange={(e) =>
                      setCompetitors((current) =>
                        current.map((c, i) => (i === index ? e.target.value : c)),
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
                        setCompetitors((current) =>
                          current.filter((_, i) => i !== index),
                        )
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

          {error ? (
            <p role="alert" className="mt-4 text-sm font-medium text-danger">
              {error}
            </p>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button
              onClick={deploy}
              disabled={pending || !website.trim() || !icp.trim()}
              size="md"
            >
              {pending ? <Loader2 className="animate-spin" /> : <Rocket />}
              Create all {missing} agents
            </Button>
            <p className="text-xs text-muted">
              They arrive as drafts. Nothing runs until you deploy it.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-fg">
        {label}
        {required ? <span className="ml-1 text-money">*</span> : null}
      </span>
      {children}
    </label>
  );
}
