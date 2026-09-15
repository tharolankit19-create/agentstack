const STEPS = [
  ["01", "Tell Kryx the outcome", "Plain English is enough: find five good leads, audit this page, watch this competitor, or prepare tomorrow’s content."],
  ["02", "Kryx picks the specialist", "The task is routed to the right agent and the smallest useful live-data call. You do not choose APIs or babysit tabs."],
  ["03", "You get work, not chatter", "Evidence, output and the decision are returned together. Anything public or outbound waits for your approval."],
] as const;

export function HowItWorks() {
  return (
    <section id="how" className="border-b border-line px-5 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <p className="microlabel">One short loop</p>
        <h2 className="mt-3 max-w-3xl text-4xl font-extrabold tracking-[-.045em] text-fg-strong sm:text-5xl">
          Tell it what to do. Kryx picks the work path.
        </h2>

        <div className="mt-9 grid overflow-hidden rounded-[22px] border border-line bg-surface md:grid-cols-3">
          {STEPS.map(([number, title, body], index) => (
            <div key={title} className={`p-5 sm:p-6 ${index ? "border-t border-line md:border-l md:border-t-0" : ""}`}>
              <p className="tnum text-sm font-bold text-accent">{number}</p>
              <h3 className="mt-10 text-xl font-extrabold text-fg-strong">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-muted">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
