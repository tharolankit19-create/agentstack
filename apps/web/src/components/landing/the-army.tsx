import { AgentAvatar } from "@/components/ui/agent-avatar";
import { roster } from "@/lib/army";

export function TheArmy() {
  const team = roster();

  return (
    <section id="team" className="border-b border-line px-5 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-7 lg:grid-cols-[.78fr_1.22fr] lg:items-end">
          <div>
            <p className="microlabel">The team</p>
            <h2 className="mt-4 max-w-xl text-4xl font-extrabold tracking-[-.045em] text-fg-strong sm:text-6xl">
              8 agents. One accountable team.
            </h2>
          </div>
          <p className="max-w-xl text-[16px] leading-7 text-muted lg:justify-self-end">
            Every agent has a face, a name and one job. You can tell who researched, who wrote, who qualified the lead and who is waiting for your decision without reading an org chart.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-4">
          {team.map((member, index) => (
            <div
              key={member.templateId}
              className="group rounded-[18px] border border-line bg-surface p-3 transition hover:-translate-y-0.5 hover:border-line-strong"
            >
              <div className="aspect-[1.25/1] overflow-hidden rounded-[14px] bg-surface-2">
                <div className="grid h-full place-items-center">
                  <AgentAvatar
                    name={member.name}
                    seed={member.templateId}
                    commander={index === 0}
                    size={92}
                    animated
                    className="shadow-[0_18px_55px_-26px_rgba(0,0,0,.55)]"
                  />
                </div>
              </div>
              <div className="pt-3">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-extrabold text-fg-strong">{member.name}</p>
                  <span className="text-[10px] font-bold uppercase tracking-[.13em] text-faint">
                    0{index + 1}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted">{member.role}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
