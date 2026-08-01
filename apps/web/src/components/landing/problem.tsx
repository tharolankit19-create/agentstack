/**
 * Empathy before the pitch. Describe the problem better than they can, and the
 * solution stops needing an explanation.
 *
 * This is the section a competitor cannot copy: it is written from the inside
 * of the job, not from a feature list.
 */
export function Problem() {
  return (
    <section className="border-b border-[var(--color-line)] px-5 py-16 sm:py-24">
      <div className="mx-auto max-w-3xl">
        <h2 className="text-3xl font-extrabold sm:text-4xl">
          You already know what to post.
          <br />
          You just never do it.
        </h2>

        <div className="mt-8 space-y-5 text-lg leading-relaxed text-[var(--color-ink-soft)]">
          <p>
            It is 11pm. You shipped three things this week and told nobody. Your
            last tweet is from March. There are two G2 reviews you have not
            answered — one of them is a 2-star — and a list of 40 leads you
            exported in January and never emailed.
          </p>
          <p>
            So you open Buffer. Then Hootsuite. Then a doc called{" "}
            <span className="font-mono text-base">content ideas.md</span> with four
            bullet points in it. You close all three.
          </p>
          <p className="font-semibold text-[var(--color-ink)]">
            The problem was never the tools. Every one of them is a place to put
            work you still have to do yourself.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          <Stat number="0" label="posts you wrote last month" />
          <Stat number="6 hrs" label="a week marketing takes when you do it" />
          <Stat number="$2,000" label="a month for someone else to do it" />
        </div>
      </div>
    </section>
  );
}

function Stat({ number, label }: { number: string; label: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-line)] p-5">
      <div className="text-3xl font-extrabold tracking-tight">{number}</div>
      <div className="mt-1 text-sm leading-snug text-[var(--color-ink-soft)]">
        {label}
      </div>
    </div>
  );
}
