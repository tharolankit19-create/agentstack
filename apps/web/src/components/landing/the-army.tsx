import { ArrowRight, BarChart3, Globe2, Search, Send, Sparkles, Target } from "lucide-react";
import { Reveal } from "@/components/ui/reveal";
import { AgentAvatar } from "@/components/ui/agent-avatar";
import { HEAD_AGENT, roster } from "@/lib/army";

const people = roster();
const tools = [
  { label: "Live web", icon: Globe2 },
  { label: "Search", icon: Search },
  { label: "Analytics", icon: BarChart3 },
  { label: "Leads", icon: Target },
  { label: "Outreach", icon: Send },
];

export function TheArmy() {
  return (
    <section id="agents" className="border-b border-line px-5 py-16 sm:py-24">
      <style>{`@keyframes kryxFloat{0%,100%{transform:translate3d(0,0,0)}50%{transform:translate3d(0,-9px,0)}}@keyframes kryxDash{to{stroke-dashoffset:-28}}@keyframes kryxGlow{0%,100%{opacity:.28}50%{opacity:.65}}`}</style>
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <p className="microlabel">One leader. A full team underneath.</p>
          <h2 className="mt-4 max-w-3xl text-3xl font-extrabold leading-tight sm:text-5xl">Tell Kryx the outcome.<br />The right people and tools get pulled in.</h2>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">Kryx acts like a head of marketing: it breaks the goal down, routes each piece to the right specialist, brings in live data when needed, then returns one decision-ready brief.</p>
        </Reveal>

        <Reveal delay={80}>
          <div className="relative mt-10 overflow-hidden rounded-[30px] border border-line bg-surface px-4 py-10 shadow-[0_30px_100px_-70px_rgba(18,28,60,.7)] sm:px-8 sm:py-14">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(79,107,255,.10),transparent_26%),radial-gradient(circle_at_72%_35%,rgba(53,201,126,.08),transparent_22%),radial-gradient(circle_at_28%_62%,rgba(255,154,90,.09),transparent_20%)]" />
            <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full opacity-55" viewBox="0 0 1000 520" preserveAspectRatio="none">
              {[160,320,500,680,840].map((x,i)=><path key={x} d={`M500 260 C ${500+(x-500)*.38} ${i%2?140:380}, ${x} ${i%2?120:400}, ${x} ${i%2?95:425}`} fill="none" stroke="currentColor" strokeWidth="1.1" strokeDasharray="7 9" style={{animation:"kryxDash 5s linear infinite"}} className="text-line-strong" />)}
            </svg>

            <div className="relative z-10 mx-auto grid max-w-5xl gap-8 lg:grid-cols-[1fr_300px_1fr] lg:items-center">
              <div className="grid grid-cols-2 gap-3">
                {people.slice(1,5).map((person,index)=><div key={person.templateId} className="rounded-2xl border border-line bg-surface/90 p-3.5 shadow-sm backdrop-blur" style={{animation:`kryxFloat ${5.2+index*.45}s ease-in-out ${index*.2}s infinite`}}><div className="flex items-center gap-3"><AgentAvatar name={person.name} seed={person.templateId} size={38}/><div className="min-w-0"><p className="truncate text-sm font-bold text-fg-strong">{person.name}</p><p className="truncate text-[11px] text-muted">{person.role}</p></div></div><p className="mt-3 line-clamp-2 text-xs leading-relaxed text-faint">{person.does}</p></div>)}
              </div>

              <div className="relative mx-auto grid min-h-[250px] w-full max-w-[300px] place-items-center">
                <div className="absolute size-56 rounded-full border border-[#4f6bff]/15" style={{animation:"kryxGlow 4s ease-in-out infinite"}} />
                <div className="absolute size-40 rounded-full bg-[#4f6bff]/8 blur-2xl" />
                <div className="relative rounded-[28px] border border-line bg-fg-strong p-5 text-bg shadow-[0_28px_70px_-32px_rgba(0,0,0,.7)]">
                  <div className="flex items-center gap-3"><AgentAvatar name={HEAD_AGENT.defaultName} seed={HEAD_AGENT.id} size={54} commander/><div><p className="text-lg font-extrabold">Kryx</p><p className="text-xs opacity-60">{HEAD_AGENT.name}</p></div></div>
                  <div className="mt-4 rounded-2xl bg-white/[.07] p-3 text-xs leading-relaxed text-white/75">“Research the drop, find the cause, draft the fix. Don’t publish until I approve.”</div>
                  <div className="mt-3 flex items-center justify-between text-[11px] font-semibold text-white/55"><span>Delegating work</span><Sparkles className="size-4 text-white"/></div>
                </div>
              </div>

              <div className="space-y-3">
                {tools.map(({label,icon:Icon},index)=><div key={label} className="flex items-center gap-3 rounded-2xl border border-line bg-surface/90 px-4 py-3 shadow-sm backdrop-blur" style={{animation:`kryxFloat ${5.4+index*.35}s ease-in-out ${index*.18}s infinite`}}><span className="grid size-9 place-items-center rounded-xl bg-surface-2 text-fg-strong"><Icon className="size-4"/></span><div className="min-w-0 flex-1"><p className="text-sm font-bold text-fg-strong">{label}</p><p className="text-xs text-muted">Pulled only when the job needs it</p></div><ArrowRight className="size-4 text-faint"/></div>)}
              </div>
            </div>

            <div className="relative z-10 mx-auto mt-8 grid max-w-5xl gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-line bg-surface-2/70 p-4"><p className="text-xs font-bold text-fg-strong">1. Kryx plans</p><p className="mt-1 text-xs leading-relaxed text-muted">One goal becomes a small set of owned tasks.</p></div>
              <div className="rounded-2xl border border-line bg-surface-2/70 p-4"><p className="text-xs font-bold text-fg-strong">2. Specialists execute</p><p className="mt-1 text-xs leading-relaxed text-muted">Research, content, search, CRO and pipeline work in parallel.</p></div>
              <div className="rounded-2xl border border-line bg-surface-2/70 p-4"><p className="text-xs font-bold text-fg-strong">3. You get the brief</p><p className="mt-1 text-xs leading-relaxed text-muted">Only the few actions that need a founder decision come back.</p></div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
