import { Reveal } from "@/components/ui/reveal";
import { TEMPLATES } from "@/lib/templates";

const FAQS: { q: string; a: string }[] = [
  {
    q: "What do I actually get for $29 a month?",
    a: `Three agents from the library of ${TEMPLATES.length}, each running on its own URL that belongs to you. They run on a schedule, save everything they produce to your dashboard, and you can chat with them. No seats, no per-message pricing, no usage tiers.`,
  },
  {
    q: "What if I use a tool you don't have an agent for?",
    a: "On Pro, paste its URL. We read the product's site and API docs, work out the job, and build you an agent that does it. Add your existing API key for that tool and the agent drives it directly — so you keep the data and stop paying for the interface.",
  },
  {
    q: "Do I need a server, Docker, or a Vercel account?",
    a: "No. Agents run on our infrastructure. You fill in a form and click Deploy. On Pro you can connect your own Vercel account instead, if you want them inside your own infrastructure.",
  },
  {
    q: "Where do my API keys go?",
    a: "They are encrypted with AES-256-GCM before they touch our database, using a key that lives only in our server environment. At deploy time they are decrypted once and written straight into your agent's own encrypted environment. They never appear in a log, never come back to your browser, and are never sent to the model.",
  },
  {
    q: "Will it post or send things without asking me?",
    a: "Not unless you turn that on. Every agent ships in draft mode: it writes, you read, you decide. Publishing and sending are settings you flip once you trust the voice, and you can flip them back.",
  },
  {
    q: "What happens if I cancel?",
    a: "Your agents stop running at the end of the month you paid for. Everything they already produced stays in your dashboard, and your configuration is kept — if you come back, one click turns them all back on. We do not delete your work because you stopped paying.",
  },
  {
    q: "Why do I need my own OpenAI key?",
    a: "So you pay OpenAI directly at their price with no markup from us. It is usually under $2 a month. It also means we never hold a credential that can spend your money.",
  },
  {
    q: "Is this just ChatGPT with extra steps?",
    a: "ChatGPT waits for you to open it. These run at 9am whether you show up or not, read your actual website and your actual reviews first, and put the output somewhere you will see it. The model is the easy part — the schedule, the inputs, and the place it lands are the product.",
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
