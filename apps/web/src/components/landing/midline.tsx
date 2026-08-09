import { Reveal } from "@/components/ui/reveal";

/**
 * One line, across the middle of the page.
 *
 * The section above it is a table, and the section below it is a how-it-works.
 * Between two structured blocks, a single sentence at display size is the only
 * thing that gets read at scroll speed — which is why the sharpest claim on
 * the page belongs here rather than buried in a column.
 *
 * The claim is also the honest one. Vibe coding produces something that runs
 * on your laptop while you are watching it. That is not the same as a thing
 * that ran at 9am on a Tuesday in March while you were asleep, and everyone
 * who has tried it knows exactly which half they got.
 */
export function Midline() {
  return (
    <section className="grid-field relative overflow-hidden border-b border-line px-5 py-20 sm:py-28">
      <div className="relative mx-auto max-w-4xl text-center">
        <Reveal>
          <p className="microlabel">The whole difference</p>
        </Reveal>

        <Reveal delay={80}>
          <p className="mt-6 text-[32px] font-extrabold leading-[1.1] tracking-tight sm:text-6xl">
            Don&rsquo;t just vibe code it.
            <br />
            <span className="text-accent">Deploy it.</span>
          </p>
        </Reveal>

        <Reveal delay={160}>
          <p className="mx-auto mt-7 max-w-2xl text-lg leading-relaxed text-muted sm:text-xl">
            A prompt gives you something that works while you are watching it.
            Nobody ever cancelled a subscription because of a file on their
            laptop. The thing that replaces a tool is the thing that is{" "}
            <span className="font-semibold text-fg">still running in March</span>{" "}
            — and that is the part the prompt does not give you.
          </p>
        </Reveal>

        <Reveal delay={220}>
          <p className="mx-auto mt-5 max-w-2xl text-[15px] text-faint">
            Ninety seconds from here to a URL that runs on a schedule. No canvas,
            no nodes, no repo to babysit.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
