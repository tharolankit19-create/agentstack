import { Reveal } from "@/components/ui/reveal";
import { SignupButton } from "./signup-button";
import { PLANS } from "@/lib/plans";

/**
 * The answer to "but I use a tool that isn't on your list".
 *
 * This is the section that turns a catalog into a category. A library of
 * twelve is a product; a library of twelve *plus whatever you paste in* is a
 * different promise entirely, and it is the reason Pro exists.
 */
export function CustomBuilder() {
  return (
    <section className="surface-dark relative overflow-hidden border-b border-[var(--color-surface-line)] px-5 py-16 sm:py-24">
      {/* One soft violet wash. The only decoration on the page. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 size-[36rem] -translate-x-1/2 rounded-full bg-[var(--color-accent)] opacity-[0.13] blur-[120px]"
      />

      <div className="relative mx-auto max-w-3xl text-center">
        <Reveal>
          <p className="inline-flex items-center gap-2 rounded-full border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#c4b5fd]">
            On {PLANS.pro.name} — ${PLANS.pro.priceUsd}/mo
          </p>
        </Reveal>

        <Reveal delay={60}>
          <h2 className="mt-6 text-3xl font-extrabold leading-tight text-white sm:text-5xl">
            Using something we don&apos;t have an agent for?
            <br />
            <span className="text-[#c4b5fd]">Paste its URL.</span>
          </h2>
        </Reveal>

        <Reveal delay={120}>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-zinc-400">
            We read the product&apos;s site and its API docs, work out what job
            people hire it to do, and build you an agent that does that job. Add
            your existing API key and the agent drives the tool directly.
          </p>
        </Reveal>

        <Reveal delay={180}>
          <div className="mx-auto mt-10 max-w-lg rounded-2xl border border-[var(--color-surface-line)] bg-[var(--color-surface-raised)] p-2 text-left">
            <div className="flex items-center gap-2 rounded-xl bg-[#0f0f0f] px-4 py-3">
              <span className="text-sm text-zinc-600">https://</span>
              <span className="flex-1 text-[15px] text-zinc-300">
                the-tool-you-pay-for.com
              </span>
              <span className="rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-xs font-bold text-white">
                Build it
              </span>
            </div>

            <ol className="space-y-2.5 px-4 py-4 text-sm text-zinc-400">
              {[
                "Reads the marketing site and the docs",
                "Works out the job, writes the agent's instructions",
                "Maps the API endpoints it found — and only those",
                "Deploys it to its own URL, on your schedule",
              ].map((step, index) => (
                <li key={step} className="flex gap-3">
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-white/5 text-[11px] font-bold text-zinc-400">
                    {index + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        </Reveal>

        <Reveal delay={240}>
          <div className="mt-10 flex flex-col items-center">
            <SignupButton>{PLANS.pro.cta}</SignupButton>
            <p className="mt-3 text-sm text-zinc-500">{PLANS.pro.ctaSubtext}</p>
          </div>
        </Reveal>

        <Reveal delay={300}>
          <p className="mx-auto mt-8 max-w-lg text-sm leading-relaxed text-zinc-600">
            It reads public pages, so it builds a sharp agent for products with
            public docs and a thinner one for products without. It never invents
            an endpoint that isn&apos;t documented — an agent that 404s on its
            first run would be worse than no agent.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
