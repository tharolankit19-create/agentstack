import { Reveal } from "@/components/ui/reveal";

/**
 * The objection, met head on.
 *
 * Anyone shopping for this in 2026 has already been told they can prompt their
 * way out of a subscription. Pretending otherwise loses the argument before it
 * starts — they can check in ten minutes, and they will.
 *
 * So the honest version: the prompt is genuinely free, and generating the code
 * is genuinely the easy part. What it does not give you is a thing that is
 * still running in March. That is a real difference, it is the whole product,
 * and it survives the reader going away to verify it.
 *
 * The left column is deliberately not a strawman. Every line of it is true and
 * several are attractive. A comparison that cheats reads as a comparison that
 * is losing.
 */

interface Row {
  step: string;
  /** What the DIY route actually costs you. */
  diy: string;
  /** What happens here instead. */
  ours: string;
}

const ROWS: Row[] = [
  {
    step: "Getting the code",
    diy: "One prompt. Genuinely free, genuinely good.",
    ours: "Already written, already reviewed, already deployed a thousand times.",
  },
  {
    step: "API keys",
    diy: "You sign up for the model provider, the mail sender, the scraper. Three accounts, three cards.",
    ours: "One key, pasted once, encrypted before it touches the database.",
  },
  {
    step: "Somewhere to run",
    diy: "A laptop that sleeps, or a VPS you now administer.",
    ours: "Its own URL, ninety seconds after you click Deploy.",
  },
  {
    step: "Running on a schedule",
    diy: "A cron you write, on a machine you keep alive.",
    ours: "Built in. It ran this morning whether or not you opened anything.",
  },
  {
    step: "When it breaks at 4am",
    diy: "You are the on-call engineer for a tool you did not want to own.",
    ours: "It retries, it reports, and the run log says what happened.",
  },
  {
    step: "When the API changes",
    diy: "Your replacement quietly stops working. You find out in a month.",
    ours: "We ship the fix to every deployment at once.",
  },
  {
    step: "The second one",
    diy: "Start over. Another repo, another cron, another thing to maintain.",
    ours: "Pick it from the list. Same ninety seconds.",
  },
];

export function VsVibecoding() {
  return (
    <section className="border-b border-line px-5 py-16 sm:py-24">
      <div className="mx-auto max-w-5xl">
        <Reveal>
          <p className="microlabel">The obvious question</p>
          <h2 className="mt-3 text-[32px] font-extrabold leading-[1.08] sm:text-[46px]">
            &ldquo;Can&rsquo;t I just vibecode this myself?&rdquo;
          </h2>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted">
            Mostly, yes — and you should, for anything you only need once. Ten
            minutes and a good prompt will get you a working replacement for a
            surprising number of tools.
            <br className="hidden sm:block" />
            <span className="font-semibold text-fg">
              {" "}
              Writing it was never the expensive part. Still having it in six
              months is.
            </span>
          </p>
        </Reveal>

        <Reveal delay={80}>
          <div className="panel mt-10 overflow-hidden">
            {/* Column headers. Hidden on mobile, where each row stacks and
                carries its own labels instead. */}
            <div className="hidden grid-cols-[1fr_1.35fr_1.35fr] gap-4 border-b border-line bg-surface-2 px-5 py-3 sm:grid">
              <span className="microlabel">Step</span>
              <span className="microlabel">Prompt it yourself</span>
              <span className="microlabel text-accent">AgentStack</span>
            </div>

            <ul>
              {ROWS.map((row, i) => (
                <li
                  key={row.step}
                  className={`grid gap-2 px-5 py-4 sm:grid-cols-[1fr_1.35fr_1.35fr] sm:gap-4 ${
                    i === ROWS.length - 1 ? "" : "border-b border-line"
                  }`}
                >
                  <span className="font-semibold text-fg-strong">{row.step}</span>

                  <span className="text-sm leading-relaxed text-muted">
                    <span className="microlabel mr-2 sm:hidden">DIY</span>
                    {row.diy}
                  </span>

                  <span className="text-sm leading-relaxed text-fg">
                    <span className="microlabel mr-2 sm:hidden">Here</span>
                    {row.ours}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>

        <Reveal delay={140}>
          <p className="mt-8 max-w-2xl text-[15px] leading-relaxed text-muted">
            If you enjoy the maintenance, do it yourself — the prompts are
            everywhere and they are free. This is for the other case: you wanted
            the job done, not a new repository.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
