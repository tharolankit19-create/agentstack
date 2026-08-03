"use client";

import { CountUp } from "@/components/ui/reveal";
import { formatUsd } from "@/lib/templates";

/**
 * The first thing in the dashboard.
 *
 * A customer who opens this and sees a grid of cards has to work out whether
 * their subscription is worth it. A customer who sees "$347/mo cancelled, for
 * $29" does not. This is the retention surface, so it leads.
 *
 * When nothing is deployed it says so plainly and points at the one action
 * that changes it — an empty state that pretends to have numbers is worse
 * than one that admits there is nothing yet.
 */
export function SavingsHeadline({
  monthlyReplaced,
  planPrice,
  deployedCount,
  generationsThisMonth,
  totalAgents,
  quota,
}: {
  monthlyReplaced: number;
  planPrice: number;
  deployedCount: number;
  generationsThisMonth: number;
  totalAgents: number;
  quota: number;
}) {
  const net = Math.max(monthlyReplaced - planPrice, 0);

  if (deployedCount === 0) {
    return (
      <header className="rounded-2xl border border-line bg-surface-2 p-6 sm:p-8">
        <h1 className="text-3xl font-extrabold text-fg-strong sm:text-4xl">
          Nothing is running yet.
        </h1>
        <p className="mt-3 max-w-xl text-[17px] leading-relaxed text-muted">
          {totalAgents === 0
            ? "Pick an agent below. It takes four fields and about 90 seconds, and it starts replacing a subscription the moment it deploys."
            : `You have ${totalAgents} agent${totalAgents === 1 ? "" : "s"} configured but not deployed. Deploy one and this turns into a number.`}
        </p>
        <p className="mt-4 text-sm text-muted">
          You can use {quota} agents on your plan.
        </p>
      </header>
    );
  }

  return (
    <header>
      <p className="text-sm font-medium text-muted">
        Software you no longer pay for
      </p>

      <h1 className="mt-2 text-5xl font-extrabold tracking-tight text-fg-strong sm:text-6xl">
        <CountUp to={monthlyReplaced} prefix="$" />
        <span className="text-2xl font-bold text-faint">/month</span>
      </h1>

      <p className="mt-3 text-[17px] leading-relaxed text-muted">
        {net > 0 ? (
          <>
            That is{" "}
            <span className="font-bold text-fg-strong">{formatUsd(net)} a month</span>{" "}
            back after your ${planPrice} — {formatUsd(net * 12)} a year.
          </>
        ) : (
          <>
            Deploy one more agent and your plan starts paying for itself.
          </>
        )}
      </p>

      <dl className="mt-6 grid gap-3 sm:grid-cols-3">
        <Stat label="Agents running" value={String(deployedCount)} />
        <Stat
          label="Made this month"
          value={generationsThisMonth.toLocaleString("en-US")}
        />
        <Stat label="Agents used" value={`${totalAgents} of ${quota}`} />
      </dl>
    </header>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface-2 px-4 py-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 text-xl font-bold tabular-nums text-fg-strong">{value}</dd>
    </div>
  );
}
