import { TEMPLATES, presentationFor } from "@/lib/templates";

/** One screen, one idea: here are the three agents, and what each replaces. */
export function Agents() {
  return (
    <section
      id="agents"
      className="border-b border-[var(--color-line)] bg-[var(--color-paper-soft)] px-5 py-16 sm:py-24"
    >
      <div className="mx-auto max-w-5xl">
        <h2 className="max-w-2xl text-3xl font-extrabold sm:text-4xl">
          Three agents. Each one does exactly one job.
        </h2>
        <p className="mt-4 max-w-xl text-lg text-[var(--color-ink-soft)]">
          Not a platform. Not a workflow builder. Three agents that already know
          what they are for.
        </p>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {TEMPLATES.map((template) => {
            const presentation = presentationFor(template.id);
            return (
              <article
                key={template.id}
                className="flex flex-col rounded-2xl border border-[var(--color-line)] bg-white p-6"
              >
                <div className="text-3xl" aria-hidden>
                  {presentation.emoji}
                </div>

                <h3 className="mt-4 text-xl font-bold">{template.name}</h3>

                <p className="mt-2 text-[15px] font-semibold leading-snug text-[var(--color-ink)]">
                  {presentation.headline}
                </p>

                <p className="mt-3 flex-1 text-[15px] leading-relaxed text-[var(--color-ink-soft)]">
                  {presentation.proof}
                </p>

                <div className="mt-5 border-t border-[var(--color-line)] pt-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-ink-faint)]">
                    Replaces
                  </p>
                  <p className="mt-1.5 text-sm font-medium text-[var(--color-ink)]">
                    {template.replaces.join(" · ")}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
