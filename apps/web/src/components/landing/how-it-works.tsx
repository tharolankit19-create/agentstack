const STEPS = [
  ["01", "Give one outcome", "Tell Kryx what you want: leads, a page fix, a research brief, content or a scheduled market check."],
  ["02", "Kryx routes the work", "It picks the specialist and the live data source, keeps result counts small, and saves the evidence."],
  ["03", "You approve the consequence", "Drafts, outreach and other consequential work wait for you. Routine research can keep running."],
] as const;

export function HowItWorks() {
  return (
    <section id="how" className="border-b border-line px-5 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-3xl text-center">
          <p className="microlabel">How it works</p>
          <h2 className="mt-4 text-4xl font-extrabold tracking-[-.045em] text-fg-strong sm:text-6xl">
            One brief in. Work comes back ready.
          </h2>
        </div>

        <div className="mt-10 grid overflow-hidden rounded-[22px] border border-line md:grid-cols-3">
          {STEPS.map(([num, title, body], index) => (
            <div key={num} className={`p-6 sm:p-7 ${index < STEPS.length - 1 ? "border-b border-line md:border-b-0 md:border-r" : ""}`}>
              <p className="font-mono text-xs font-bold text-accent">{num}</p>
              <h3 className="mt-8 text-xl font-extrabold text-fg-strong">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-muted">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
