import { BarChart3, FileSearch, Globe2, Mail, MessageSquareText, Search, Send, Target, TrendingUp } from "lucide-react";
import { LogoMark } from "@/components/ui/logo";

const INPUTS = [
  [Globe2, "Website", "pages + changes"],
  [Search, "Search", "queries + rankings"],
  [BarChart3, "Analytics", "traffic + funnel"],
  [MessageSquareText, "Reviews", "customer language"],
  [Mail, "Inbox", "replies + intent"],
] as const;

const OUTPUTS = [
  [FileSearch, "Research", "evidence brief"],
  [TrendingUp, "CRO", "next experiment"],
  [Search, "SEO", "pages + fixes"],
  [Target, "Leads", "qualified pipeline"],
  [Send, "Content", "drafts ready"],
] as const;

export function AgentFlow() {
  return (
    <section id="agents" className="px-5 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <p className="kryx-kicker">One head. A specialist team behind it.</p>
          <h2 className="mt-3 text-3xl font-bold tracking-[-.045em] text-fg-strong sm:text-5xl">Signals flow in. Finished work comes out.</h2>
          <p className="mx-auto mt-4 max-w-xl text-[16px] leading-7 text-muted sm:text-[17px]">Kryx connects the context, routes each job to the right specialist, and returns one concise brief instead of a wall of agent chatter.</p>
        </div>

        <div className="kryx-tool-stage mt-10 sm:mt-12">
          <div className="kryx-tool-lane" aria-label="Signals entering Kryx">
            <div className="kryx-tool-track">
              {[...INPUTS, ...INPUTS].map(([Icon, name, detail], index) => <ToolNode key={`in-${name}-${index}`} icon={<Icon className="size-4"/>} name={name} detail={detail} />)}
            </div>
          </div>
          <div className="kryx-tool-core">
            <div className="grid size-14 place-items-center rounded-[18px] bg-[#0b0d12] text-white shadow-[0_16px_40px_-18px_rgba(0,0,0,.55)]"><LogoMark size={36}/></div>
            <div className="text-center"><p className="text-sm font-extrabold text-fg-strong">Kryx</p><p className="text-[11px] text-muted">routes · checks · combines</p></div>
            <span className="kryx-core-pulse" aria-hidden />
          </div>
          <div className="kryx-tool-lane kryx-tool-lane-reverse" aria-label="Specialist work leaving Kryx">
            <div className="kryx-tool-track">
              {[...OUTPUTS, ...OUTPUTS].map(([Icon, name, detail], index) => <ToolNode key={`out-${name}-${index}`} icon={<Icon className="size-4"/>} name={name} detail={detail} />)}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ToolNode({ icon, name, detail }: { icon: React.ReactNode; name: string; detail: string }) {
  return <div className="kryx-tool-node"><span className="kryx-tool-node-icon">{icon}</span><span><strong>{name}</strong><small>{detail}</small></span></div>;
}
