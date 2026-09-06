import { ExternalLink } from "lucide-react";
import { ToolIcon } from "@/components/ui/tool-icon";
import type { FreeAlternative } from "@/lib/free-alternatives";

/**
 * The free option, named before we pitch ours.
 *
 * This section costs us money and it is here on purpose. A page that says
 * "cancel Calendly, pay us $49" while never mentioning that Cal.com is free
 * and open-source is a page a reader will eventually catch out — and the whole
 * directory runs on not being caught out.
 *
 * So the free option goes first, with its catch stated plainly, and then one
 * honest sentence about what it does not solve: none of these write anything.
 * Swapping a paid scheduler for a free one you host yourself does not fill the
 * queue. That was never a pricing problem.
 */
export function FreeAlternatives({
  toolName,
  alternatives,
  hasAgent,
}: {
  toolName: string;
  alternatives: FreeAlternative[];
  hasAgent: boolean;
}) {
  if (alternatives.length === 0) return null;

  return (
    <section className="border-b border-line px-5 py-14">
      <div className="mx-auto max-w-3xl">
        <p className="text-sm font-semibold tracking-normal text-faint">
          Before you pay anyone
        </p>
        <h2 className="mt-3 text-2xl font-extrabold sm:text-3xl">
          The free way to do {toolName}&rsquo;s job
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          These are real, and we would rather you heard it here. Each one is
          free in money and costs something else &mdash; the catch is written
          next to it.
        </p>

        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {alternatives.map((alternative) => (
            <li
              key={alternative.name}
              className="flex gap-3 rounded-xl border border-line bg-surface-2 p-4"
            >
              <ToolIcon
                domain={alternative.domain}
                name={alternative.name}
                className="mt-0.5 size-7 rounded-md"
              />

              <div className="min-w-0">
                <a
                  href={`https://${alternative.domain}`}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="inline-flex items-center gap-1.5 font-bold text-fg-strong hover:text-accent"
                >
                  {alternative.name}
                  <ExternalLink className="size-3.5 text-faint" aria-hidden />
                </a>

                <span
                  className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-normal ${
                    alternative.kind === "open-source"
                      ? "bg-[var(--live-wash)] text-live"
                      : "bg-surface-3 text-muted"
                  }`}
                >
                  {alternative.kind === "open-source" ? "Open source" : "Free tier"}
                </span>

                <p className="mt-1.5 text-sm leading-relaxed text-muted">
                  {alternative.note}
                </p>
              </div>
            </li>
          ))}
        </ul>

        <p className="mt-6 border-l-2 border-line pl-5 text-[15px] leading-relaxed text-muted">
          <span className="font-semibold text-fg">
            None of these do the work.
          </span>{" "}
          They are somewhere to put it. Your posting queue was not empty because
          the scheduler cost money, and a free scheduler you have to host
          yourself will be just as empty on Monday.
          {hasAgent
            ? " Our agent is the part that fills it — and it works the same whether the thing underneath is free or paid."
            : " That is the part we would replace, and on this tool we cannot."}
        </p>
      </div>
    </section>
  );
}
