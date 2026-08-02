import { Reveal } from "@/components/ui/reveal";
import { templatesByCategory, TEMPLATES, formatUsd } from "@/lib/templates";

/**
 * The library.
 *
 * The objection this section answers is "yes but does it do *my* thing". So it
 * shows every agent, grouped, with the product each one replaces and what that
 * product costs. No "and more" — the whole list is the proof.
 */
export function Library() {
  const groups = templatesByCategory();

  return (
    <section
      id="agents"
      className="border-b border-[var(--color-line)] bg-[var(--color-paper-soft)] px-5 py-16 sm:py-24"
    >
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <h2 className="max-w-3xl text-3xl font-extrabold sm:text-5xl">
            {TEMPLATES.length} agents. Nothing to build.
          </h2>
          <p className="mt-4 max-w-2xl text-lg text-[var(--color-ink-soft)]">
            Each one already knows its job. You give it a URL and a key, and it
            starts working on a schedule. There is no canvas, no node editor, and
            no prompt to write.
          </p>
        </Reveal>

        <div className="mt-12 space-y-12">
          {groups.map((group, groupIndex) => (
            <div key={group.category}>
              <Reveal delay={groupIndex * 40}>
                <h3 className="flex items-baseline gap-3 text-sm font-bold uppercase tracking-wider text-[var(--color-ink-faint)]">
                  {group.category}
                  <span className="h-px flex-1 bg-[var(--color-line)]" />
                </h3>
              </Reveal>

              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {group.templates.map((template, index) => (
                  <Reveal key={template.id} delay={index * 50}>
                    <article className="group h-full rounded-2xl border border-[var(--color-line)] bg-white p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--color-accent)] hover:shadow-[0_8px_30px_rgba(139,92,246,0.10)]">
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-2xl" aria-hidden>
                          {template.icon}
                        </span>
                        <span className="rounded-full bg-[var(--color-paper-soft)] px-2.5 py-1 text-xs font-bold tabular-nums text-[var(--color-ink-soft)] transition-colors group-hover:bg-[var(--color-accent-soft)] group-hover:text-[var(--color-accent-hover)]">
                          saves {formatUsd(template.replaces.monthlyUsd)}/mo
                        </span>
                      </div>

                      <h4 className="mt-4 font-bold">{template.name}</h4>
                      <p className="mt-1.5 text-[15px] leading-snug text-[var(--color-ink-soft)]">
                        {template.description}
                      </p>

                      <p className="mt-4 border-t border-[var(--color-line)] pt-3 text-xs font-medium text-[var(--color-ink-faint)]">
                        Replaces{" "}
                        <span className="font-bold text-[var(--color-ink)]">
                          {template.replaces.tools.join(", ")}
                        </span>
                      </p>
                    </article>
                  </Reveal>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
