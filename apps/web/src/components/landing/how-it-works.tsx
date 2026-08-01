const STEPS: { n: string; title: string; body: string }[] = [
  {
    n: "1",
    title: "Pick an agent",
    body: "Content, Review, or Lead. Three cards. You pick one.",
  },
  {
    n: "2",
    title: "Fill in 4 fields",
    body: "Your website, your tone, your OpenAI key. That is the whole setup.",
  },
  {
    n: "3",
    title: "Click Deploy",
    body: "90 seconds later your agent is live on its own URL, running on schedule.",
  },
];

/** Show the shape of the work, so "how hard is this?" never becomes a reason to leave. */
export function HowItWorks() {
  return (
    <section className="border-b border-[var(--color-line)] px-5 py-16 sm:py-24">
      <div className="mx-auto max-w-4xl">
        <h2 className="text-3xl font-extrabold sm:text-4xl">
          Three steps. No terminal.
        </h2>

        <ol className="mt-10 grid gap-8 sm:grid-cols-3">
          {STEPS.map((step) => (
            <li key={step.n}>
              <div className="grid size-10 place-items-center rounded-full bg-[var(--color-ink)] text-base font-bold text-white">
                {step.n}
              </div>
              <h3 className="mt-4 text-lg font-bold">{step.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-[var(--color-ink-soft)]">
                {step.body}
              </p>
            </li>
          ))}
        </ol>

        <p className="mt-10 rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-soft)] p-5 text-[15px] leading-relaxed text-[var(--color-ink-soft)]">
          <span className="font-semibold text-[var(--color-ink)]">
            No cloning a repo. No .env file. No Docker.
          </span>{" "}
          The agents run on infrastructure we already paid for. You never see a
          build log unless you ask for one.
        </p>
      </div>
    </section>
  );
}
