const FAQS: { q: string; a: string }[] = [
  {
    q: "How much does it cost?",
    a: "KryxAI has no monthly seat fee in the current offering. You start with 100 credits. Specialist work spends visible credits, and you can top up from $5. Purchased credits do not expire.",
  },
  {
    q: "What is a credit?",
    a: "A simple unit of specialist work. The pricing page shows the current credit cost for drafts, searches, checks, lead work and briefings before you spend anything.",
  },
  {
    q: "Do I need to bring model API keys?",
    a: "No model key is required to start the hosted product. KryxAI uses its configured providers for specialist work. Connected third-party tools can still have their own permissions, limits or charges.",
  },
  {
    q: "What do the specialists actually do?",
    a: "Kryx can delegate across research, SEO and AEO, content, conversion, leads, outreach, analytics and competitor work. The point is not a fixed number of agents — it is routing each job to the specialist that should do it.",
  },
  {
    q: "Will it publish or send consequential work without asking me?",
    a: "The product is designed to keep consequential actions in the approval loop. Drafts, outreach and other external actions should be reviewed before they are sent or published.",
  },
  {
    q: "Do I need a server, Docker, or a Vercel account?",
    a: "No. The hosted product runs the team for you. You sign in, configure the workspace and start delegating.",
  },
  {
    q: "Where does it report?",
    a: "Kryx reports in the product and can use connected channels such as Telegram when configured. The goal is to bring back the work and the few decisions that actually need you.",
  },
  {
    q: "Is this just a chat wrapper?",
    a: "The useful part is the operating loop: scheduled work, live research and tools, specialist delegation, approvals, persistent context and finished work coming back into one workspace.",
  },
  {
    q: "What if it finds nothing?",
    a: "It should say so. A quiet result is better than invented activity. Research and lead work are useful only when the evidence is visible enough for you to judge.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="border-b border-line px-5 py-16 sm:py-24">
      <div className="mx-auto max-w-3xl">
        <h2 className="text-3xl font-extrabold sm:text-5xl">Questions people ask</h2>

        <div className="mt-10 divide-y divide-[var(--line)] border-y border-line">
          {FAQS.map((faq) => (
              <details key={faq.q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold [&::-webkit-details-marker]:hidden">
                  {faq.q}
                  <span
                    aria-hidden
                    className="shrink-0 text-2xl font-light text-faint transition-transform duration-300 group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-3 max-w-2xl text-[17px] leading-relaxed text-muted">{faq.a}</p>
              </details>
          ))}
        </div>
      </div>
    </section>
  );
}
