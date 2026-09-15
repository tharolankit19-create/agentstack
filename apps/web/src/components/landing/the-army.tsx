import { AgentAvatar } from "@/components/ui/agent-avatar";
import { roster } from "@/lib/army";

const MEMBERS = roster();

export function TheArmy() {
  return (
    <section id="agents" className="border-b border-line px-5 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-5 lg:grid-cols-[.8fr_1.2fr] lg:items-end">
          <div>
            <p className="microlabel">The Kryx team</p>
            <h2 className="mt-3 text-4xl font-extrabold tracking-[-.045em] text-fg-strong sm:text-5xl">
              8 agents. One person to brief.
            </h2>
          </div>
          <p className="max-w-2xl text-[15px] leading-7 text-muted lg:justify-self-end">
            You talk to Kryx. Kryx routes the job to the specialist that owns it,
            then brings the result back with evidence and a clear next move.
          </p>
        </div>

        <div className="mt-9 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {MEMBERS.map((member) => (
            <article key={member.templateId} className="group rounded-[20px] border border-line bg-surface p-3.5 transition hover:-translate-y-0.5 hover:border-line-strong hover:shadow-[var(--shadow-sm)] sm:p-4">
              <AgentAvatar
                name={member.name}
                seed={member.templateId}
                commander={member.templateId === "head-agent"}
                size={58}
                className="transition-transform group-hover:scale-[1.03]"
              />
              <p className="mt-3 text-[15px] font-extrabold text-fg-strong">{member.name}</p>
              <p className="mt-0.5 text-[11px] font-semibold text-accent">{member.role}</p>
              <p className="mt-2 line-clamp-3 text-[12px] leading-5 text-muted">{member.does}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
