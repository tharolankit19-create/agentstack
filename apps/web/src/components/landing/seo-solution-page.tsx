import Link from "next/link";
import { Header } from "@/components/landing/header";
import { Footer } from "@/components/landing/footer";

export function SeoSolutionPage({
  eyebrow,
  title,
  intro,
  problems,
  how,
  outcome,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  problems: string[];
  how: string[];
  outcome: string;
}) {
  return (
    <>
      <Header signedIn={false} />
      <main className="mx-auto max-w-4xl px-5 py-16 sm:py-24">
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-accent">{eyebrow}</p>
        <h1 className="mt-4 max-w-3xl text-4xl font-extrabold tracking-tight text-fg-strong sm:text-6xl">{title}</h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-muted">{intro}</p>

        <section className="mt-14 grid gap-5 md:grid-cols-2">
          <div className="rounded-2xl border border-line bg-surface-2 p-6">
            <h2 className="text-xl font-bold text-fg-strong">What founders usually get stuck doing</h2>
            <ul className="mt-4 space-y-3 text-[15px] leading-7 text-muted">
              {problems.map((item) => <li key={item}>• {item}</li>)}
            </ul>
          </div>
          <div className="rounded-2xl border border-line bg-surface-2 p-6">
            <h2 className="text-xl font-bold text-fg-strong">How KryxAI handles it</h2>
            <ol className="mt-4 space-y-3 text-[15px] leading-7 text-muted">
              {how.map((item, index) => <li key={item}><span className="font-bold text-fg-strong">{index + 1}.</span> {item}</li>)}
            </ol>
          </div>
        </section>

        <section className="mt-12 rounded-2xl border border-line bg-surface p-7">
          <h2 className="text-2xl font-bold text-fg-strong">The goal</h2>
          <p className="mt-3 text-base leading-7 text-muted">{outcome}</p>
          <p className="mt-4 text-sm leading-6 text-faint">KryxAI keeps public, outbound, spend and other consequential actions approval-gated. Research, analysis and draft preparation can keep moving without waiting on the founder.</p>
        </section>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/login?mode=signup" className="rounded-xl bg-accent px-5 py-3 text-sm font-bold text-accent-fg">Start free</Link>
          <Link href="/demo" className="rounded-xl border border-line px-5 py-3 text-sm font-bold text-fg-strong">See the live demo</Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
