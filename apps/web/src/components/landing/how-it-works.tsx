const STEPS = [
  ["Set the context", "Tell Kryx what you sell, who buys and what outcome matters now."],
  ["Give it a mission", "Ask for a lead list, page audit, content brief or scheduled market check."],
  ["Review the receipt", "See what changed, which sources support it and what action is ready."],
] as const;

export function HowItWorks() {
  return (
    <section id="how" className="border-b border-line px-5 py-16 sm:py-24">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[.78fr_1.22fr]">
        <div><p className="microlabel">From goal to approval</p><h2 className="mt-4 max-w-md text-4xl sm:text-5xl">A short loop you can inspect.</h2></div>
        <div className="border-t border-line">
          {STEPS.map(([title, body], index) => (
            <div key={title} className="grid gap-3 border-b border-line py-6 sm:grid-cols-[54px_190px_1fr]">
              <span className="tnum text-sm text-faint">0{index + 1}</span><h3 className="text-lg">{title}</h3><p className="text-sm leading-6 text-muted">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
