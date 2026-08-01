const FAQS: { q: string; a: string }[] = [
  {
    q: "What do I actually get for $29?",
    a: "Three agents, each running on its own URL that belongs to you. They run on a schedule, store what they write, and you can chat with them from the dashboard. You pay once. There is no monthly bill and no seat count.",
  },
  {
    q: "Do I need a server, Docker, or a Vercel account?",
    a: "No. On the $29 plan the agents run on our infrastructure. You fill in a form and click Deploy. On the $59 plan you can connect your own Vercel account instead, if you want the agents inside your own infrastructure.",
  },
  {
    q: "Where do my API keys go?",
    a: "They are encrypted with AES-256-GCM before they touch our database, using a key that lives only in our server environment. At deploy time they are decrypted once and written straight into your agent's own encrypted environment. Nobody at AgentStack reads them, and they never appear in a log or in the agent's own transcript.",
  },
  {
    q: "Will it post things without asking me?",
    a: "Not unless you turn that on. Every agent ships in draft mode: it writes, you read, you decide. Publishing is a setting you flip once you trust the voice, and you can flip it back.",
  },
  {
    q: "Why do I need my own OpenAI key?",
    a: "So you pay OpenAI directly for what you generate, at their price, with no markup from us. It is usually under $2 a month. It also means we never hold a key that can spend your money.",
  },
  {
    q: "What if the writing is bad?",
    a: "Try it before you pay — the demo at the top of this page is the real Content Agent, running on your real website, for free. If the drafts are not good, do not buy it.",
  },
  {
    q: "Can I change what the agents say?",
    a: "Yes. Tone, audience, and how often they run are settings in the dashboard. On the $59 plan you can edit the underlying prompts directly.",
  },
  {
    q: "Is there a refund?",
    a: "Email within 14 days and you get your money back, no questions. You keep whatever the agents already wrote.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="border-b border-[var(--color-line)] px-5 py-16 sm:py-24">
      <div className="mx-auto max-w-3xl">
        <h2 className="text-3xl font-extrabold sm:text-4xl">Questions people ask</h2>

        <div className="mt-8 divide-y divide-[var(--color-line)] border-y border-[var(--color-line)]">
          {FAQS.map((faq) => (
            <details key={faq.q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold [&::-webkit-details-marker]:hidden">
                {faq.q}
                <span
                  aria-hidden
                  className="shrink-0 text-2xl font-light text-[var(--color-ink-faint)] transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="mt-3 max-w-2xl text-[17px] leading-relaxed text-[var(--color-ink-soft)]">
                {faq.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
