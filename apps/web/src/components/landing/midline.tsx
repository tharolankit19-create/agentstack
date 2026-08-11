import { Reveal } from "@/components/ui/reveal";
import { HEAD_AGENT } from "@/lib/army";

/**
 * One line, across the middle of the page.
 *
 * Between two structured blocks, a single sentence at display size is the only
 * thing that gets read at scroll speed — which is why the sharpest claim on the
 * page belongs here rather than buried in a column.
 *
 * It used to be an argument against vibe coding, which was a leftover from a
 * different product: it spent the biggest type on the page telling people what
 * this is *not*. The claim that earns that space is the one thing nothing else
 * does — the work is already finished when you wake up, and somebody tells you.
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
            You don&rsquo;t open it.
            <br />
            <span className="text-accent">It opens you.</span>
          </p>
        </Reveal>

        <Reveal delay={160}>
          <p className="mx-auto mt-7 max-w-2xl text-lg leading-relaxed text-muted sm:text-xl">
            Every other tool is a page you have to remember to check. This one
            messages you first — {HEAD_AGENT.defaultName} at the hour you
            picked, with{" "}
            <span className="font-semibold text-fg">the work already done</span>{" "}
            and nothing to do but say yes.
          </p>
        </Reveal>

        <Reveal delay={220}>
          <p className="mx-auto mt-7 max-w-2xl text-lg leading-relaxed text-muted sm:text-xl">
            And it is not the same army in March that you deployed in January.
            Every run, each agent writes down what worked and what did not, and{" "}
            <span className="font-semibold text-fg">
              starts the next one already knowing
            </span>
            .
          </p>
        </Reveal>

        <Reveal delay={280}>
          <p className="mx-auto mt-5 max-w-2xl text-[15px] text-faint">
            One setup, one button, one message a day. No canvas, no nodes, no
            repo to babysit.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
