import { Check, FileSearch, Search, Send, ShieldCheck } from "lucide-react";

const WORK = [
  [Search, "Research", "Checks the live market, competitors and customer language before writing."],
  [FileSearch, "Search & conversion", "Finds the page, query or funnel problem and returns a concrete fix."],
  [Send, "Pipeline", "Finds, filters and prepares outreach for people who can actually buy."],
] as const;

export function TheArmy() {
  return (
    <section id="work" className="border-b border-line px-5 py-16 sm:py-24">
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[.78fr_1.22fr]">
        <div>
          <p className="microlabel">The system behind Kryx</p>
          <h2 className="mt-4 max-w-xl text-4xl sm:text-5xl">You manage one outcome. Kryx manages the work.</h2>
          <p className="mt-5 max-w-lg text-[16px] leading-7 text-muted">Specialists stay in the infrastructure. You see the task, its evidence, the draft and the decision it needs.</p>
          <div className="mt-8 border-l-2 border-accent pl-5"><p className="font-serif text-xl italic leading-7 text-fg">“I found nothing” is a valid result. Invented activity is not.</p></div>
        </div>

        <div className="border-t border-line">
          {WORK.map(([Icon, title, body]) => (
            <div key={title} className="grid gap-4 border-b border-line py-6 sm:grid-cols-[46px_180px_1fr] sm:items-start">
              <span className="grid size-10 place-items-center border border-line bg-surface text-fg-strong"><Icon className="size-4" /></span>
              <h3 className="text-lg">{title}</h3>
              <p className="text-sm leading-6 text-muted">{body}</p>
            </div>
          ))}
          <div className="grid gap-4 py-6 sm:grid-cols-[46px_180px_1fr] sm:items-start">
            <span className="grid size-10 place-items-center border border-money-line bg-money-wash text-money"><ShieldCheck className="size-4" /></span>
            <h3 className="text-lg">Approval</h3>
            <div className="text-sm leading-6 text-muted"><p>Consequential work waits in your queue.</p><p className="mt-2 inline-flex items-center gap-2 font-semibold text-fg"><Check className="size-3.5 text-money" /> You keep the final say.</p></div>
          </div>
        </div>
      </div>
    </section>
  );
}
