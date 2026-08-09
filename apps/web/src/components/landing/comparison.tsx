import { Check, Minus, X } from "lucide-react";
import { Reveal } from "@/components/ui/reveal";

/**
 * People do not care what a product does. They care why they should switch.
 * So: the same seven questions, asked of the three real options, answered
 * honestly — including where we lose.
 */

const ROWS: { label: string; us: string; stack: string; diy: string }[] = [
  { label: "Does the work itself", us: "yes", stack: "no", diy: "yes" },
  { label: "Works on day one", us: "yes", stack: "yes", diy: "no" },
  { label: "Runs on a schedule without you", us: "yes", stack: "no", diy: "yes" },
  { label: "Nothing to learn", us: "yes", stack: "no", diy: "no" },
  { label: "Covers a tool we have not built yet", us: "paste its URL", stack: "n/a", diy: "yes" },
  { label: "Cost per month", us: "$29–$149", stack: "$1,000+", diy: "$20 + your weekend" },
  { label: "Who fixes it when an API changes", us: "we do", stack: "they do", diy: "you do" },
];

export function Comparison() {
  return (
    <section className="border-b border-line px-5 py-16 sm:py-24">
      <div className="mx-auto max-w-4xl">
        <Reveal>
          <h2 className="text-3xl font-extrabold sm:text-5xl">
            Three ways to do this. Here they are.
          </h2>
        </Reveal>

        <Reveal delay={80}>
          <div className="mt-10 overflow-x-auto">
            <table className="w-full min-w-[600px] border-collapse text-left">
              <thead>
                <tr className="border-b border-line">
                  <th className="py-3 pr-4" />
                  <th className="px-4 py-3 text-base font-extrabold text-accent">
                    AgentStack
                  </th>
                  <th className="px-4 py-3 text-base font-semibold text-muted">
                    Your current stack
                  </th>
                  <th className="px-4 py-3 text-base font-semibold text-muted">
                    Build it yourself
                  </th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row) => (
                  <tr key={row.label} className="border-b border-line">
                    <td className="py-4 pr-4 text-[15px] font-medium">{row.label}</td>
                    <Cell value={row.us} emphasis />
                    <Cell value={row.stack} />
                    <Cell value={row.diy} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>

        <Reveal delay={140}>
          <p className="mt-5 text-sm leading-relaxed text-faint">
            Stack cost is the list price of the tools in our library, for one
            user, as published at the time of writing. If you build it yourself
            with n8n or a cron job, you will get something better tuned than
            this — you will just be maintaining it.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

function Cell({ value, emphasis = false }: { value: string; emphasis?: boolean }) {
  if (value === "yes") {
    return (
      <td className="px-4 py-4">
        <Check
          className={
            emphasis ? "size-5 text-accent" : "size-5 text-muted"
          }
          aria-label="yes"
        />
      </td>
    );
  }
  if (value === "no") {
    return (
      <td className="px-4 py-4">
        <X className="size-5 text-faint" aria-label="no" />
      </td>
    );
  }
  if (value === "n/a") {
    return (
      <td className="px-4 py-4">
        <Minus className="size-5 text-faint" aria-label="not applicable" />
      </td>
    );
  }
  return (
    <td className="px-4 py-4">
      <span
        className={
          emphasis
            ? "text-[15px] font-extrabold text-fg"
            : "text-[15px] text-muted"
        }
      >
        {value}
      </span>
    </td>
  );
}
