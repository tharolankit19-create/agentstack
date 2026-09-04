import { Reveal } from "@/components/ui/reveal";
import { TEMPLATES } from "@/lib/templates";

const FAQS: { q: string; a: string }[] = [
  {
    q: "How much does it cost?",
    a: "Nothing to start — you get 500 credits when you sign up, which is enough to watch it run a real morning. After that you buy credit when you want it, from $12. There is no subscription and nothing to cancel; an unused balance just sits there.",
  },
  {
    q: "What is a credit?",
    a: "A unit of work. Finding leads that match your customer is 25 credits a search; finding one person's email is 12; reading a page is 3; your morning briefing is 2. The full list is on this page, above the packs — you can work out your own bill before you spend anything.",
  },
  {
    q: "Do I need to bring any API keys?",
    a: "No. The models, the data and the web reader all run on ours — that is what the credits pay for. You can connect your own accounts later if you would rather the work ran under them, and then it stops costing credits.",
  },
  {
    q: "What do the five specialists actually do?",
    a: "SEO and AEO audits your pages against what currently ranks and against what AI answers quote. Research tells you what changed in your market this week. Content writes the drafts. Leads finds people who match your customer and writes each of them a real email. Competitor analysis reports only what actually moved.",
  },
  {
    q: "Will it post or send anything without asking me?",
    a: "No, and this is not a setting you can turn off by accident. Everything arrives as a draft you approve. Cold emails go out only after you say so, and then slowly rather than in a burst, because a burst is what gets a sending domain blocked.",
  },
  {
    q: "Do I need a server, Docker, or a Vercel account?",
    a: "No. We run the whole team. You sign in, answer three things, and it starts.",
  },
  {
    q: "Where does it report?",
    a: "Telegram, once a morning, and you can talk back to it there — ask for ten leads, or what changed at a competitor, and it goes and does that rather than describing how it would.",
  },
  {
    q: "Is this just ChatGPT with extra steps?",
    a: "ChatGPT answers when you open it. This runs on a schedule whether you open it or not, it reads live data rather than what it remembers, and it hands you finished work in the morning. The difference is not the model — it is that nobody has to remember to ask.",
  },
  {
    q: "What if it finds nothing?",
    a: "It says so. A quiet week reported as quiet is worth more than a padded one, and an agent that invents activity to look busy is one you stop reading by the second week.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="border-b border-line px-5 py-16 sm:py-24">
      <div className="mx-auto max-w-3xl">
        <Reveal>
          <h2 className="text-3xl font-extrabold sm:text-5xl">Questions people ask</h2>
        </Reveal>

        <div className="mt-10 divide-y divide-[var(--line)] border-y border-line">
          {FAQS.map((faq, index) => (
            <Reveal key={faq.q} delay={Math.min(index, 4) * 50}>
              <details className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold [&::-webkit-details-marker]:hidden">
                  {faq.q}
                  <span
                    aria-hidden
                    className="shrink-0 text-2xl font-light text-faint transition-transform duration-300 group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-3 max-w-2xl text-[17px] leading-relaxed text-muted">
                  {faq.a}
                </p>
              </details>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
