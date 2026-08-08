"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { AgentCard } from "./agent-card";
import { CATEGORIES, type AgentTemplate, type TemplateCategory } from "@/lib/templates";
import { cn } from "@/lib/utils";
import type { Agent, AgentStats, CustomAgent } from "@/lib/supabase/types";

/**
 * The library, filtered.
 *
 * Twelve agents is enough that a flat grid stops being browsable, so this
 * filters by category and by what you already run. Search matches the product
 * names too — someone looking for "Hootsuite" should land on the Content
 * Agent without knowing we call it that.
 */
export function AgentLibrary({
  templates,
  agents,
  customAgents,
  stats,
  quota,
}: {
  templates: AgentTemplate[];
  agents: Agent[];
  customAgents: CustomAgent[];
  stats: AgentStats[];
  quota: number;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<TemplateCategory | "All" | "Mine">("All");
  const [sort, setSort] = useState<"saving" | "alpha">("saving");

  const statsById = useMemo(
    () => new Map(stats.map((row) => [row.agent_id, row])),
    [stats],
  );
  const byTemplate = useMemo(
    () => new Map(agents.filter((a) => !a.custom_agent_id).map((a) => [a.template_id, a])),
    [agents],
  );
  const customAgentRows = agents.filter((a) => a.custom_agent_id);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();

    const matched = templates.filter((template) => {
      if (category === "Mine" && !byTemplate.has(template.id)) return false;
      if (category !== "All" && category !== "Mine" && template.category !== category) {
        return false;
      }
      if (!needle) return true;

      return (
        template.name.toLowerCase().includes(needle) ||
        template.description.toLowerCase().includes(needle) ||
        template.replaces.tools.some((tool) => tool.toLowerCase().includes(needle))
      );
    });

    // Expensive first by default. The library's job is to get someone to the
    // agent that saves them the most, and alphabetical buries it.
    return [...matched].sort((a, b) =>
      sort === "saving"
        ? b.replaces.monthlyUsd - a.replaces.monthlyUsd || a.name.localeCompare(b.name)
        : a.name.localeCompare(b.name),
    );
  }, [templates, query, category, byTemplate, sort]);

  // What is still on the table: every agent they have not created yet.
  const unclaimedMonthly = useMemo(
    () =>
      templates
        .filter((template) => !byTemplate.has(template.id))
        .reduce((sum, template) => sum + template.replaces.monthlyUsd, 0),
    [templates, byTemplate],
  );

  const quotaReached = agents.length >= quota;

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-fg-strong">The library</h2>
          {unclaimedMonthly > 0 ? (
            <p className="mt-0.5 text-sm text-muted">
              <span className="font-bold text-live">
                ${unclaimedMonthly.toLocaleString()}/mo
              </span>{" "}
              of subscriptions you have not replaced yet.
            </p>
          ) : null}
        </div>

        <label className="relative flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search agents or tools…"
            aria-label="Search agents"
            className="w-full rounded-lg border border-line bg-surface-2 py-2 pl-9 pr-3 text-sm text-fg placeholder:text-faint focus:border-accent focus:outline-none"
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <Chip active={category === "All"} onClick={() => setCategory("All")}>
          All {templates.length}
        </Chip>
        {byTemplate.size > 0 ? (
          <Chip active={category === "Mine"} onClick={() => setCategory("Mine")}>
            Mine {byTemplate.size}
          </Chip>
        ) : null}
        {CATEGORIES.map((name) => (
          <Chip
            key={name}
            active={category === name}
            onClick={() => setCategory(name)}
          >
            {name}
          </Chip>
        ))}

        <label className="ml-auto inline-flex items-center gap-2 rounded-full border border-line px-3 py-1.5 text-sm focus-within:border-accent">
          <span className="font-medium text-faint">Sort</span>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as "saving" | "alpha")}
            className="cursor-pointer bg-transparent font-medium text-fg outline-none"
          >
            <option value="saving">Biggest saving</option>
            <option value="alpha">A–Z</option>
          </select>
        </label>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-muted">
          Nothing matches “{query}”. We may not have built that one yet — on Pro
          you can paste its URL and we will.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((template) => {
            const agent = byTemplate.get(template.id);
            return (
              <AgentCard
                key={template.id}
                template={template}
                agent={agent}
                stats={agent ? statsById.get(agent.id) : undefined}
                quotaReached={quotaReached && !agent}
              />
            );
          })}
        </div>
      )}

      {customAgentRows.length > 0 ? (
        <div className="space-y-4 pt-4">
          <h2 className="text-xl font-bold text-fg-strong">Built from your tools</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {customAgentRows.map((agent) => {
              const spec = customAgents.find((c) => c.id === agent.custom_agent_id)?.spec;
              return (
                <AgentCard
                  key={agent.id}
                  template={{
                    id: "custom-agent",
                    name: spec?.name ?? agent.name,
                    description: spec?.description ?? "Built from your own tool.",
                    category: "Custom",
                    icon: "🧩",
                    replaces: spec?.replaces ?? { tools: [], monthlyUsd: 0 },
                    frequency: "",
                    model: "",
                    temperature: 0,
                    maxIterations: 0,
                    tools: [],
                    prompts: [],
                    scheduledTask: "",
                    settings: [],
                    secrets: [],
                  }}
                  agent={agent}
                  stats={statsById.get(agent.id)}
                  quotaReached={false}
                />
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
        active
          ? "bg-surface text-fg"
          : "border border-line text-muted hover:border-line-strong hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}
