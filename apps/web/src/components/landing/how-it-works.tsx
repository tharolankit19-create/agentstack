import { Reveal } from "@/components/ui/reveal";

const STEPS = [
  {
    n: "1",
    title: "Pick the agent",
    body: "From the library, or paste the URL of a tool you already pay for and we build one.",
  },
  {
    n: "2",
    title: "Give it a URL and a key",
    body: "Four fields. Your website, your tone, your OpenAI key. That is the whole setup.",
  },
  {
    n: "3",
    title: "It goes to work",
    body: "Live on its own URL in 90 seconds, running on its schedule. You read the output.",
  },
];

/** Show the shape of the work, so "how hard is this?" never becomes a reason to leave. */
export function HowItWorks() {
  return (
    <section className="border-b border-line px-5 py-16 sm:py-24">
      <div className="mx-auto max-w-4xl">
        <Reveal>
          <h2 className="text-3xl font-extrabold sm:text-5xl">
            Three steps. No terminal.
          </h2>
        </Reveal>

        <ol className="mt-12 grid gap-8 sm:grid-cols-3">
          {STEPS.map((step, index) => (
            <Reveal key={step.n} delay={index * 90} as="li">
                <div className="grid size-11 place-items-center rounded-full bg-[var(--fg)] text-lg font-bold text-fg-strong">
                  {step.n}
                </div>
                <h3 className="mt-4 text-lg font-bold">{step.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-muted">
                  {step.body}
                </p>
            </Reveal>
          ))}
        </ol>

        <Reveal delay={280}>
          <p className="mt-12 rounded-2xl border border-line bg-surface-2 p-6 text-[15px] leading-relaxed text-muted">
            <span className="font-semibold text-fg">
              No repo to clone. No .env file. No Docker. No workflow to draw.
            </span>{" "}
            Every agent runs on infrastructure we already pay for, on its own
            URL. You never see a build log unless you ask for one.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
