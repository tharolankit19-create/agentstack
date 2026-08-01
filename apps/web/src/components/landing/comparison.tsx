import { Check, X } from "lucide-react";

/**
 * People do not care what the product does. They care why they should switch.
 * So: the same four questions, asked of every option, answered honestly.
 */

const ROWS: { label: string; agentstack: string; buffer: string; agency: string }[] = [
  {
    label: "Writes the posts for you",
    agentstack: "yes",
    buffer: "no",
    agency: "yes",
  },
  {
    label: "Answers your reviews",
    agentstack: "yes",
    buffer: "no",
    agency: "yes",
  },
  {
    label: "Finds your leads",
    agentstack: "yes",
    buffer: "no",
    agency: "sometimes",
  },
  {
    label: "Runs while you sleep",
    agentstack: "yes",
    buffer: "no",
    agency: "no",
  },
  {
    label: "Cost in year one",
    agentstack: "$29",
    buffer: "$72–$1,200",
    agency: "$24,000",
  },
  {
    label: "Cost in year two",
    agentstack: "$0",
    buffer: "$72–$1,200",
    agency: "$24,000",
  },
  {
    label: "Time to set up",
    agentstack: "90 seconds",
    buffer: "an afternoon",
    agency: "3 weeks",
  },
];

export function Comparison() {
  return (
    <section className="border-b border-[var(--color-line)] px-5 py-16 sm:py-24">
      <div className="mx-auto max-w-4xl">
        <h2 className="text-3xl font-extrabold sm:text-4xl">
          Why switch? Here it is, side by side.
        </h2>

        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left">
            <thead>
              <tr className="border-b border-[var(--color-line)]">
                <th className="py-3 pr-4 text-sm font-medium text-[var(--color-ink-faint)]">
                  {""}
                </th>
                <th className="px-4 py-3 text-base font-extrabold text-[var(--color-accent)]">
                  AgentStack
                </th>
                <th className="px-4 py-3 text-base font-semibold text-[var(--color-ink-soft)]">
                  Buffer / Hootsuite
                </th>
                <th className="px-4 py-3 text-base font-semibold text-[var(--color-ink-soft)]">
                  An agency
                </th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.label} className="border-b border-[var(--color-line)]">
                  <td className="py-4 pr-4 text-[15px] font-medium">{row.label}</td>
                  <Cell value={row.agentstack} emphasis />
                  <Cell value={row.buffer} />
                  <Cell value={row.agency} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-5 text-sm text-[var(--color-ink-faint)]">
          Competitor pricing is list price for a single user as published at the
          time of writing. Agency figure assumes $2,000 a month.
        </p>
      </div>
    </section>
  );
}

function Cell({ value, emphasis = false }: { value: string; emphasis?: boolean }) {
  const isYes = value === "yes";
  const isNo = value === "no";

  return (
    <td className="px-4 py-4">
      {isYes ? (
        <Check
          className={
            emphasis
              ? "size-5 text-[var(--color-accent)]"
              : "size-5 text-[var(--color-ink-soft)]"
          }
          aria-label="yes"
        />
      ) : isNo ? (
        <X className="size-5 text-[var(--color-ink-faint)]" aria-label="no" />
      ) : (
        <span
          className={
            emphasis
              ? "text-[15px] font-extrabold text-[var(--color-ink)]"
              : "text-[15px] text-[var(--color-ink-soft)]"
          }
        >
          {value}
        </span>
      )}
    </td>
  );
}
