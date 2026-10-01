const FAQS: { q: string; a: string }[] = [
  {
    q: "What is Kryx?",
    a: "Kryx is a founder's agent army. You give it the job, not a workflow diagram. Kryx decides which specialist skills, tools and execution surface the work needs, then brings back the result and the decisions that still need you.",
  },
  {
    q: "Is this still only a marketing product?",
    a: "Marketing and growth remain strong parts of Kryx, but the product now also covers founder operations such as research, inbox triage, docs, meetings, spreadsheets, browser work and approved device actions.",
  },
  {
    q: "Do I have to choose an agent first?",
    a: "No. The default experience is one Kryx. It can assemble research, growth, pipeline and founder-operations skills behind a mission without making you manage separate agent chats.",
  },
  {
    q: "Can Kryx work on my computer or Android device?",
    a: "Yes, when a task needs local context and the device is connected. Kryx can use approved browser or device capabilities while keeping the same account, credits, missions and approvals across web and device apps.",
  },
  {
    q: "Can it send messages or publish things without me?",
    a: "External actions use separate approval policies. Research and drafts can be low-friction; sending, publishing or editing an external system can wait in Needs You. Sensitive actions such as payments, destructive deletion and account-security changes remain restricted.",
  },
  {
    q: "What does Always allow mean?",
    a: "It should be narrow. For example, you can allow Kryx to open a specific app in future missions without granting unrestricted authority to send, publish, delete or change security settings inside that app.",
  },
  {
    q: "How much does it cost?",
    a: "Kryx uses prepaid credits rather than a monthly seat in the current offering. New accounts start with 100 credits. Billable model/tool work uses credits; local clicks are not charged just for existing.",
  },
  {
    q: "Do I need to bring model API keys?",
    a: "No model key is required to start the hosted product. Kryx uses its configured provider routing and failover. A connected third-party service may still have its own permissions or limits.",
  },
  {
    q: "What happens when Kryx cannot finish something?",
    a: "It should surface the exact blocker — for example a login, CAPTCHA, missing permission, unavailable device or changed interface — instead of pretending the work completed.",
  },
  {
    q: "Is Observer Mode always watching me?",
    a: "No. Observer Mode is optional and explicitly enabled. It is intended to capture structured workflow metadata in allowed apps so Kryx can propose repeated routines for automation, not to keylog passwords or private text.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="border-b border-line px-5 py-16 sm:py-24">
      <div className="mx-auto max-w-3xl">
        <p className="microlabel">FAQ</p>
        <h2 className="mt-3 text-3xl font-extrabold sm:text-5xl">
          What founders ask before handing over real work.
        </h2>

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
              <p className="mt-3 max-w-2xl text-[16px] leading-7 text-muted">{faq.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
