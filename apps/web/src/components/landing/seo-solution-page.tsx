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
      <main className="mx-auto max-w-6xl px-5 pb-20 pt-28 sm:pt-36">
        <div className="grid gap-8 border-b border-line pb-12 lg:grid-cols-[.72fr_1.28fr]">
          <div><p className="microlabel">{eyebrow}</p><h1 className="mt-4 max-w-3xl text-4xl text-fg-strong sm:text-6xl">{title}</h1></div>
          <p className="max-w-2xl text-lg leading-8 text-muted lg:pt-8">{intro}</p>
        </div>

        <section className="grid gap-10 border-b border-line py-12 md:grid-cols-2">
          <div>
            <h2 className="text-xl font-bold text-fg-strong">What founders usually get stuck doing</h2>
            <ul className="mt-4 space-y-3 text-[15px] leading-7 text-muted">
              {problems.map((item) => <li key={item} className="border-t border-line py-3">{item}</li>)}
            </ul>
          </div>
          <div>
            <h2 className="text-xl font-bold text-fg-strong">How KryxAI handles it</h2>
            <ol className="mt-4 space-y-3 text-[15px] leading-7 text-muted">
              {how.map((item, index) => <li key={item} className="grid grid-cols-[34px_1fr] border-t border-line py-3"><span className="tnum text-faint">0{index + 1}</span><span>{item}</span></li>)}
            </ol>
          </div>
        </section>

        <section className="grid gap-5 border-b border-line py-12 md:grid-cols-[.72fr_1.28fr]">
          <h2 className="text-2xl font-bold text-fg-strong">The goal</h2>
          <div><p className="text-base leading-7 text-muted">{outcome}</p><p className="mt-4 text-sm leading-6 text-faint">KryxAI keeps public, outbound, spend and other consequential actions approval-gated. Research, analysis and draft preparation can keep moving without waiting on the founder.</p></div>
        </section>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/login?mode=signup" className="kryx-button kryx-button-primary h-11 px-5 text-sm">Start free</Link>
          <Link href="/demo" className="kryx-button kryx-button-secondary h-11 px-5 text-sm">Use the product demo</Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
