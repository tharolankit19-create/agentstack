import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { HEAD_AGENT } from "@/lib/army";

/**
 * The top of the page.
 *
 * Two decisions carry this, and both are in DESIGN.md as rules.
 *
 * **A person, not a category.** "AI marketing agents" is a category anyone can
 * claim and nobody can picture. A named head of marketing is a colleague, and a
 * colleague is something a founder already knows how to want. The five things
 * he runs are named plainly underneath, because the category still has to be
 * legible — it just is not the headline.
 *
 * **Show the work, do not describe it.** The strongest thing on this page is
 * the message he actually sends: real format, real shape, the numbers a real
 * morning produces. A screenshot of the product working beats every sentence
 * about it working, which is why there is no feature grid here and no badge
 * above the headline — both are the house style of pages that had nothing to
 * show.
 *
 * There is deliberately no pill badge, no 1-2-3 sequence and no row of icon
 * cards. Those three are the most recognisable marks of a generated page, and
 * a visitor reads them before they read a word of the copy.
 */
export function Hero() {
  return (
    <section className="border-b border-line px-5 pb-20 pt-16 sm:pt-24">
      <div className="mx-auto grid max-w-6xl gap-14 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-20">
        <div>
          <h1 className="max-w-xl text-balance text-[46px] leading-[0.98] tracking-[-0.03em] sm:text-[68px]">
            {HEAD_AGENT.defaultName}, your
            <br />
            head of marketing.
          </h1>

          <p className="mt-7 max-w-lg text-[19px] leading-relaxed text-muted">
            He runs five specialists — SEO and AEO, research, content, leads,
            competitor analysis — and messages you one briefing a morning on
            Telegram. You reply to approve. Nothing goes out before you do.
          </p>

          <div className="mt-10 flex flex-col gap-5 sm:flex-row sm:items-center">
            <Link
              href="/login?mode=signup"
              className="group inline-flex h-14 items-center justify-center gap-2.5 rounded-[var(--r-control)] bg-accent px-8 text-[17px] font-semibold text-accent-fg shadow-[var(--raise)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--raise-hover)] active:translate-y-px active:shadow-[var(--raise-press)]"
            >
              Put {HEAD_AGENT.defaultName} to work — free for 3 days
              <ArrowRight className="size-5 transition-transform group-hover:translate-x-0.5" />
            </Link>

            {/* Second action, deliberately quiet. A visitor who is not ready
                to sign up currently has nowhere to go but away, and a page that
                offers only one door loses everyone who is not ready to walk
                through it. */}
            <Link
              href="/demo"
              className="inline-flex h-14 items-center justify-center rounded-[var(--r-control)] border border-line bg-surface px-6 text-[16px] font-semibold text-fg shadow-[var(--shadow-sm)] transition-all hover:border-line-strong hover:bg-surface-2 hover:shadow-[var(--shadow)] active:translate-y-px"
            >
              Look inside first
            </Link>
          </div>

          {/* What removes the last objection, in the founder's own terms.
              "No credit card" is table stakes and says nothing; what someone is
              actually weighing at this point is whether they will have wasted
              an evening. Three mornings is the answer, because the thing being
              sold is a morning that has already happened. */}
          <p className="mt-4 text-sm leading-relaxed text-muted">
            No card. Three days, three morning briefings, three batches of
            leads — then $49/month if you keep it. One click to stop.
          </p>
        </div>

        {/* The product, doing the thing. Everything in it is the real format of
            a real briefing — no invented customer names, no fabricated
            revenue. A mocked-up testimonial here would be the one lie on the
            page, and it is the first thing anyone checks. */}
        <BriefingPreview />
      </div>
    </section>
  );
}

function BriefingPreview() {
  return (
    <figure className="rounded-xl border border-line bg-surface p-1.5 shadow-lg">
      <div className="rounded-lg bg-surface-2 px-5 py-4">
        <p className="flex items-center gap-2 border-b border-line pb-3 text-[13px] font-semibold text-muted">
          <span className="size-2 rounded-full bg-accent" aria-hidden />
          {HEAD_AGENT.defaultName} · Telegram · 7:02
        </p>

        <div className="space-y-3.5 pt-4 text-[15px] leading-relaxed">
          <p className="text-fg">Morning. Three things.</p>

          <p className="text-fg">
            <span className="font-semibold text-fg-strong">Leads.</span> 41 new,
            18 worth writing to. Emails drafted for all 18 — say the word and
            they go out over the day, not in one burst.
          </p>

          <p className="text-fg">
            <span className="font-semibold text-fg-strong">Search.</span> You
            slipped to 8 for your main term. The page ranking above you answers
            the question in its first line; yours takes four paragraphs. I have
            written the replacement opener.
          </p>

          <p className="text-fg">
            <span className="font-semibold text-fg-strong">Competitor.</span>{" "}
            One dropped their demo gate on Tuesday. Free trial straight from the
            homepage now.
          </p>

          <p className="pt-1 text-muted">
            Reply <span className="font-semibold text-fg">1</span> to approve
            everything, <span className="font-semibold text-fg">2</span> to read
            it first.
          </p>
        </div>
      </div>

      <figcaption className="px-4 py-3 text-[13px] text-faint">
        The shape of a real morning briefing. Yours reports your numbers.
      </figcaption>
    </figure>
  );
}
