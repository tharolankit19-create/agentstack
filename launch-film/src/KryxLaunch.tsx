import React from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const C = {
  bg:"#0b0a09",
  bg2:"#121110",
  panel:"#171513",
  panel2:"#1f1c19",
  line:"#332f2a",
  text:"#ffffff",
  muted:"#a69e95",
  faint:"#746d65",
  accent:"#f08a3c",
  green:"#3fe081",
  amber:"#ffb224",
  red:"#ff5f57",
};

const CLICK = "data:audio/wav;base64,UklGRvQCAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YdACAAAAAKsA6wEhAj0A4vxF+sL6Cv8vBXsJowgoAib54/K58y/8FQiXEB4Q7gUi9yLs4euF99EIJBWNFc8Jivh56/vp5/QUBtQTZxZYDFT78uxO6XbyPwM0EuYWrw4y/rju/eg78FwAShAJF8sQFQHE8AnpQO55/R4OzxajEvYDDfNx6Y3soPq6CzkWMBTGBov1NOoo69z3JglJFWsVewkz+FDrF+o59W0GAxRQFgkM+vq/7F/pwfKaA2wS2xZnDtX9fO4C6X/wuQCLEAoXixC5AH/wAul87tX9Zw7bFmwSmgPB8l/pv+z6+gkMUBYDFG0GOfUX6lDrM/h7CWsVSRUmCdz3KOs06ov1xgYwFDkWugug+o3scekN8/YDoxLPFh4Oef1A7gnpxPAVAcsQCRdKEFwAO/D96LjuMv6vDuYWNBI/A3byTuny7FT7WAxnFtQTFAbn9PvpeeuK+M8JjRUkFdEIhfcB61Pq3vUeB1wUHxZqC0b6XOyE6VrzUQTZEsEW1Q0d/QXuEekK8XIBChEHFwgQAAD47/no9u6O/vYO7xb7EeMCK/I/6Sftr/umDHwWpBO6BZb04emk6+L4IgqtFf8Uewgv99zqc+ox9nYHhxQFFhkL7Pks7JnpqPOsBA4TshaKDcH8zO0a6VHxzgFIEQMXxQ+k/7bv9+g17+v+PA/3FsARhwLi8THpXe0K/PMMjxZzE2AFRvTH6dDrOvl1CswV2BQkCNr2t+qV6oX2zQewFOkVpQq8+b3szeq39KYEkhFeFMEL2fwc8JPs8PPJATsOZRI1DHH/Y/O57s3zev8MCxgQCwx2AXX2JfFC9MD9HQiUDVAL4wI7+brzP/Wh/IYF9AoWCrUDnvtd9rH2HfxbA1YIcgjsA4z98PiA+DH8rgHVBXwGjwP2/lj7lvrT/IkAjANOBKoC0/98/db89/32/5MBAwJLARwARf8l/4z/9v8=";

const mono = "'SFMono-Regular', Menlo, Consolas, monospace";
const sans = "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

const fade = (f:number, a:number, b:number) => interpolate(f,[a,b],[0,1],{extrapolateLeft:"clamp",extrapolateRight:"clamp"});
const out = (f:number, a:number, b:number) => interpolate(f,[a,b],[1,0],{extrapolateLeft:"clamp",extrapolateRight:"clamp"});

const Grid: React.FC = () => (
  <AbsoluteFill style={{
    backgroundImage:
      "linear-gradient(rgba(255,255,255,.028) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.028) 1px, transparent 1px)",
    backgroundSize:"52px 52px",
    opacity:.65,
  }}/>
);

const Chrome: React.FC<{children:React.ReactNode; title?:string; style?:React.CSSProperties}> = ({children,title,style}) => (
  <div style={{
    border:`1px solid ${C.line}`, background:C.panel, borderRadius:22, overflow:"hidden",
    boxShadow:"0 30px 90px rgba(0,0,0,.42)", ...style
  }}>
    <div style={{height:54,borderBottom:`1px solid ${C.line}`,display:"flex",alignItems:"center",padding:"0 18px",gap:9,background:C.bg2}}>
      <span style={{width:9,height:9,borderRadius:99,background:"#5d5750"}}/>
      <span style={{width:9,height:9,borderRadius:99,background:"#5d5750"}}/>
      <span style={{width:9,height:9,borderRadius:99,background:"#5d5750"}}/>
      <span style={{marginLeft:10,fontSize:13,color:C.muted,fontFamily:mono}}>{title || "KryxAI"}</span>
    </div>
    {children}
  </div>
);

const Logo: React.FC<{size?:number}> = ({size=46}) => (
  <div style={{display:"flex",alignItems:"center",gap:14}}>
    <div style={{
      width:size,height:size,borderRadius:12,border:`1px solid ${C.line}`,background:C.bg2,
      display:"grid",placeItems:"center",position:"relative"
    }}>
      <div style={{width:size*.42,height:size*.42,borderRadius:99,border:`3px solid ${C.accent}`,boxShadow:`0 0 0 7px rgba(240,138,60,.08)`}}/>
      <div style={{position:"absolute",width:5,height:5,borderRadius:99,background:C.green,right:size*.18,top:size*.18}}/>
    </div>
    <div style={{fontFamily:sans,fontWeight:800,fontSize:size*.55,letterSpacing:"-.04em",color:C.text}}>KryxAI</div>
  </div>
);

const Kicker: React.FC<{children:React.ReactNode}> = ({children}) => (
  <div style={{fontFamily:mono,fontSize:14,textTransform:"uppercase",letterSpacing:".16em",color:C.accent}}>{children}</div>
);

const Intro: React.FC<{vertical:boolean}> = ({vertical}) => {
  const f=useCurrentFrame();
  const p=spring({frame:f,fps:30,config:{damping:16,stiffness:110,mass:.9}});
  return <AbsoluteFill style={{background:C.bg,color:C.text,fontFamily:sans,justifyContent:"center",alignItems:"center"}}>
    <Grid/>
    <div style={{position:"relative",textAlign:"center",padding:vertical?50:80,transform:`scale(${.94+.06*p})`,opacity:fade(f,0,22)*out(f,95,119)}}>
      <div style={{display:"flex",justifyContent:"center",marginBottom:26}}><Logo size={vertical?64:56}/></div>
      <Kicker>Introducing</Kicker>
      <h1 style={{fontSize:vertical?104:126,lineHeight:.88,letterSpacing:"-.065em",margin:"20px 0 0",fontWeight:850}}>KryxAI</h1>
      <p style={{fontSize:vertical?31:34,color:C.muted,margin:"24px auto 0",maxWidth:vertical?760:900,lineHeight:1.25}}>
        the agent stack for marketing work
      </p>
    </div>
  </AbsoluteFill>
};

const Chaos: React.FC<{vertical:boolean}> = ({vertical}) => {
  const f=useCurrentFrame();
  const tabs=["Research","Leads","Content","Follow-ups","Daily checks","Approvals","Analytics"];
  return <AbsoluteFill style={{background:C.bg,color:C.text,fontFamily:sans,padding:vertical?"120px 52px":"88px 110px"}}>
    <Grid/>
    <div style={{position:"relative",height:"100%",display:"flex",flexDirection:vertical?"column":"row",alignItems:"center",justifyContent:"space-between",gap:50}}>
      <div style={{width:vertical?"100%":"46%",opacity:fade(f,0,18)}}>
        <Kicker>The founder problem</Kicker>
        <h2 style={{fontSize:vertical?82:78,lineHeight:.98,letterSpacing:"-.055em",margin:"18px 0 22px",maxWidth:900}}>
          Marketing became<br/>tab management.
        </h2>
        <p style={{fontSize:vertical?28:25,lineHeight:1.45,color:C.muted,maxWidth:700}}>
          Every task lives somewhere else. You spend the day moving context instead of moving the business.
        </p>
      </div>
      <div style={{position:"relative",width:vertical?"100%":"48%",height:vertical?760:700}}>
        {tabs.map((t,i)=>{
          const local=f-i*7;
          const s=spring({frame:local,fps:30,config:{damping:17,stiffness:140}});
          const x=vertical?0:(i%2===0?-60:70);
          const rot=(i-3)*1.3;
          return <div key={t} style={{
            position:"absolute",left:`${12+i*4}%`,top:28+i*74,width:vertical?700:600,
            transform:`translateX(${x*(1-s)}px) translateY(${(1-s)*35}px) rotate(${rot}deg) scale(${.93+.07*s})`,
            opacity:Math.max(0,Math.min(1,s)),
            border:`1px solid ${C.line}`,background:i===6?C.panel2:C.panel,borderRadius:16,padding:"22px 24px",
            boxShadow:"0 20px 60px rgba(0,0,0,.35)"
          }}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <span style={{fontWeight:760,fontSize:vertical?25:22}}>{t}</span>
              <span style={{fontFamily:mono,fontSize:12,color:C.faint}}>OPEN</span>
            </div>
          </div>
        })}
      </div>
    </div>
  </AbsoluteFill>
};

const OneGoal: React.FC<{vertical:boolean}> = ({vertical}) => {
  const f=useCurrentFrame();
  const s=spring({frame:f-8,fps:30,config:{damping:17,stiffness:120}});
  return <AbsoluteFill style={{background:C.bg,color:C.text,fontFamily:sans,alignItems:"center",justifyContent:"center",padding:vertical?54:100}}>
    <Grid/>
    <div style={{width:"100%",maxWidth:vertical?940:1500,opacity:fade(f,0,18)*out(f,155,179)}}>
      <div style={{textAlign:"center",marginBottom:vertical?50:44}}>
        <Kicker>One goal in</Kicker>
        <h2 style={{fontSize:vertical?78:82,lineHeight:.98,letterSpacing:"-.055em",margin:"18px 0 0"}}>
          Come back to finished work.
        </h2>
      </div>
      <Chrome title="KryxAI · Morning brief" style={{transform:`scale(${.96+.04*s})`}}>
        <div style={{padding:vertical?28:34}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
            <div><div style={{fontWeight:800,fontSize:vertical?28:25}}>Morning brief</div><div style={{color:C.muted,fontSize:14,marginTop:4}}>sample workspace · today</div></div>
            <div style={{color:C.green,fontWeight:800,fontSize:14}}>● 3 ready</div>
          </div>
          {[
            ["06:52","Competitor trial change found","Pricing page changed Tuesday · source saved","Evidence attached"],
            ["07:01","Homepage problem isolated","Answer appears four paragraphs too late","Rewrite ready"],
            ["07:04","18 prospects kept from 41 found","Non-buyers removed before outreach","List ready"],
          ].map((r,i)=>(
            <div key={r[0]} style={{display:"grid",gridTemplateColumns:"74px 1fr",gap:12,padding:"18px 0",borderTop:`1px solid ${C.line}`,opacity:fade(f,25+i*15,40+i*15)}}>
              <div style={{fontFamily:mono,fontSize:13,color:C.faint}}>{r[0]}</div>
              <div>
                <div style={{fontWeight:760,fontSize:vertical?22:20}}>{r[1]}</div>
                <div style={{color:C.muted,fontSize:15,marginTop:5}}>{r[2]}</div>
                <div style={{color:C.green,fontSize:13,fontWeight:700,marginTop:8}}>✓ {r[3]}</div>
              </div>
            </div>
          ))}
          <div style={{display:"flex",justifyContent:"space-between",borderTop:`1px solid ${C.line}`,paddingTop:18,color:C.muted,fontSize:14}}>
            <span>2 decisions need you</span><strong style={{color:C.text}}>Review work →</strong>
          </div>
        </div>
      </Chrome>
    </div>
  </AbsoluteFill>
};

type Mission={lane:string; title:string; detail:string; accent?:string};
const MissionControl: React.FC<{vertical:boolean}> = ({vertical}) => {
  const f=useCurrentFrame();
  const missions:Mission[]=[
    {lane:"Needs you",title:"Approve founder outreach draft",detail:"12 qualified accounts · trigger attached",accent:C.accent},
    {lane:"In flight",title:"Audit launch page",detail:"Search + CRO specialist working"},
    {lane:"Queued",title:"Refresh competitor evidence",detail:"Runs after page audit"},
    {lane:"Done today",title:"Pricing change detected",detail:"Source saved",accent:C.green},
  ];
  const approved=f>210;
  return <AbsoluteFill style={{background:C.bg,color:C.text,fontFamily:sans,padding:vertical?"104px 44px":"76px 90px"}}>
    <Grid/>
    <div style={{position:"relative",maxWidth:1600,margin:"0 auto",width:"100%"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"end",gap:30,marginBottom:34}}>
        <div>
          <Kicker>Mission Control</Kicker>
          <h2 style={{fontSize:vertical?70:68,lineHeight:1,letterSpacing:"-.05em",margin:"14px 0 0"}}>The work moves.<br/>You keep the final say.</h2>
        </div>
        {!vertical && <div style={{color:C.muted,fontSize:18,maxWidth:450,lineHeight:1.45}}>Public, outbound or irreversible actions stop at approval.</div>}
      </div>
      <Chrome title="KryxAI · Mission Control">
        <div style={{padding:20}}>
          <div style={{display:"grid",gridTemplateColumns:vertical?"1fr 1fr":"repeat(4,1fr)",gap:12}}>
            {missions.map((m,i)=>{
              const local=f-18-i*11;
              const sp=spring({frame:local,fps:30,config:{damping:16,stiffness:140}});
              const moved=approved&&i===0;
              return <div key={m.lane} style={{border:`1px solid ${C.line}`,background:C.bg2,borderRadius:14,padding:12,minHeight:vertical?255:330,opacity:Math.max(0,Math.min(1,sp))}}>
                <div style={{fontSize:13,fontWeight:800,color:C.muted,display:"flex",justifyContent:"space-between"}}><span>{moved?"Done today":m.lane}</span><span style={{fontFamily:mono}}>1</span></div>
                <div style={{
                  marginTop:10,border:`1px solid ${moved?C.green:m.accent||C.line}`,background:moved?"rgba(63,224,129,.07)":C.panel,
                  borderRadius:12,padding:14,transform:moved?"translateY(8px)":"none"
                }}>
                  {(i===0&&!moved) && <div style={{fontSize:11,fontWeight:800,color:C.accent,marginBottom:7}}>NEEDS YOUR APPROVAL</div>}
                  {(i===0&&moved) && <div style={{fontSize:11,fontWeight:800,color:C.green,marginBottom:7}}>APPROVED</div>}
                  <div style={{fontWeight:760,fontSize:vertical?19:17,lineHeight:1.2}}>{m.title}</div>
                  <div style={{fontSize:13,color:C.muted,lineHeight:1.4,marginTop:8}}>{m.detail}</div>
                </div>
              </div>
            })}
          </div>
          <div style={{display:"flex",justifyContent:"flex-end",gap:10,marginTop:14}}>
            <div style={{border:`1px solid ${C.line}`,padding:"11px 15px",borderRadius:10,color:C.muted,fontSize:13}}>Ask Kryx</div>
            <div style={{background:approved?C.green:C.text,color:C.bg,padding:"11px 17px",borderRadius:10,fontWeight:800,fontSize:13}}>
              {approved?"Approved ✓":"Approve"}
            </div>
          </div>
        </div>
      </Chrome>
    </div>
    {f===210?<Audio src={CLICK} volume={.7}/>:null}
  </AbsoluteFill>
};

const Army: React.FC<{vertical:boolean}> = ({vertical}) => {
  const f=useCurrentFrame();
  const rows=[
    ["Market Intelligence","live market, competitors, customer language","Research"],
    ["Search & Conversion","SEO, AEO, GEO, landing pages, CRO","Search"],
    ["Revenue Pipeline","finds, filters and prepares outreach","Pipeline"],
  ];
  return <AbsoluteFill style={{background:C.bg,color:C.text,fontFamily:sans,padding:vertical?"110px 52px":"86px 110px"}}>
    <Grid/>
    <div style={{maxWidth:1500,margin:"0 auto",width:"100%"}}>
      <div style={{display:"grid",gridTemplateColumns:vertical?"1fr":"0.78fr 1.22fr",gap:vertical?50:85,alignItems:"start"}}>
        <div>
          <Kicker>Behind one interface</Kicker>
          <h2 style={{fontSize:vertical?74:72,lineHeight:.98,letterSpacing:"-.055em",margin:"16px 0 20px"}}>Kryx manages the work.</h2>
          <p style={{fontSize:vertical?26:22,lineHeight:1.48,color:C.muted}}>Specialists stay in the infrastructure. You see the task, evidence, draft and decision.</p>
        </div>
        <div style={{borderTop:`1px solid ${C.line}`}}>
          {rows.map((r,i)=>{
            const sp=spring({frame:f-12-i*18,fps:30,config:{damping:16,stiffness:130}});
            return <div key={r[0]} style={{display:"grid",gridTemplateColumns:vertical?"70px 1fr":"56px 240px 1fr",gap:18,padding:"27px 0",borderBottom:`1px solid ${C.line}`,opacity:Math.max(0,Math.min(1,sp)),transform:`translateX(${(1-sp)*24}px)`}}>
              <div style={{width:44,height:44,border:`1px solid ${C.line}`,display:"grid",placeItems:"center",borderRadius:10,color:C.accent,fontFamily:mono}}>{String(i+1).padStart(2,"0")}</div>
              <div>
                <div style={{fontSize:vertical?24:21,fontWeight:800}}>{r[0]}</div>
                {vertical && <div style={{fontSize:17,color:C.muted,marginTop:6}}>{r[1]}</div>}
              </div>
              {!vertical && <div style={{fontSize:17,color:C.muted,lineHeight:1.5}}>{r[1]}<div style={{fontFamily:mono,color:C.faint,fontSize:12,marginTop:8}}>{r[2].toUpperCase()} WORKSTREAM</div></div>}
            </div>
          })}
          <div style={{display:"grid",gridTemplateColumns:vertical?"70px 1fr":"56px 240px 1fr",gap:18,padding:"27px 0"}}>
            <div style={{width:44,height:44,border:`1px solid rgba(63,224,129,.35)`,background:"rgba(63,224,129,.08)",display:"grid",placeItems:"center",borderRadius:10,color:C.green}}>✓</div>
            <div style={{fontSize:vertical?24:21,fontWeight:800}}>Approval</div>
            {!vertical && <div style={{fontSize:17,color:C.muted}}>Consequential work waits in your queue. <span style={{color:C.text,fontWeight:750}}>You keep the final say.</span></div>}
          </div>
        </div>
      </div>
    </div>
  </AbsoluteFill>
};

const Leads: React.FC<{vertical:boolean}> = ({vertical}) => {
  const f=useCurrentFrame();
  const progress=interpolate(f,[30,130],[0,1],{extrapolateLeft:"clamp",extrapolateRight:"clamp"});
  const found=Math.round(41*progress);
  const kept=Math.round(18*progress);
  const rows=[
    ["NexaFlow","B2B SaaS","pricing page changed","92"],
    ["Tracebase","Devtools","hiring first growth lead","88"],
    ["Northline","AI ops","new enterprise plan","84"],
    ["RelayFox","Analytics","recent funding signal","81"],
  ];
  return <AbsoluteFill style={{background:C.bg,color:C.text,fontFamily:sans,padding:vertical?"110px 48px":"82px 100px"}}>
    <Grid/>
    <div style={{maxWidth:1500,margin:"0 auto",width:"100%"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"end",gap:30,marginBottom:28}}>
        <div><Kicker>Revenue Pipeline</Kicker><h2 style={{fontSize:vertical?72:68,letterSpacing:"-.05em",margin:"14px 0 0"}}>Find fewer. Keep the right ones.</h2></div>
        {!vertical && <div style={{display:"flex",gap:24,fontFamily:mono}}>
          <div><div style={{fontSize:42,fontWeight:800}}>{found}</div><div style={{fontSize:12,color:C.faint}}>FOUND</div></div>
          <div><div style={{fontSize:42,fontWeight:800,color:C.green}}>{kept}</div><div style={{fontSize:12,color:C.faint}}>KEPT</div></div>
        </div>}
      </div>
      {vertical && <div style={{display:"flex",gap:18,marginBottom:20}}>
        <div style={{flex:1,border:`1px solid ${C.line}`,borderRadius:14,padding:18}}><div style={{fontFamily:mono,fontSize:40,fontWeight:800}}>{found}</div><div style={{fontSize:12,color:C.faint}}>FOUND</div></div>
        <div style={{flex:1,border:`1px solid rgba(63,224,129,.3)`,background:"rgba(63,224,129,.05)",borderRadius:14,padding:18}}><div style={{fontFamily:mono,fontSize:40,fontWeight:800,color:C.green}}>{kept}</div><div style={{fontSize:12,color:C.faint}}>KEPT</div></div>
      </div>}
      <Chrome title="KryxAI · Leads">
        <div style={{padding:vertical?20:24}}>
          <div style={{display:"grid",gridTemplateColumns:vertical?"1.1fr .8fr .5fr":"1.2fr .9fr 1.5fr .4fr",gap:12,padding:"0 10px 12px",fontFamily:mono,fontSize:11,color:C.faint}}>
            <span>COMPANY</span><span>{vertical?"TRIGGER":"SEGMENT"}</span>{!vertical&&<span>TRIGGER</span>}<span>SCORE</span>
          </div>
          {rows.map((r,i)=>(
            <div key={r[0]} style={{display:"grid",gridTemplateColumns:vertical?"1.1fr .8fr .5fr":"1.2fr .9fr 1.5fr .4fr",gap:12,padding:"17px 10px",borderTop:`1px solid ${C.line}`,opacity:fade(f,55+i*11,68+i*11)}}>
              <div style={{fontWeight:800}}>{r[0]}</div>
              <div style={{color:C.muted,fontSize:14}}>{vertical?r[2]:r[1]}</div>
              {!vertical&&<div style={{color:C.muted,fontSize:14}}>{r[2]}</div>}
              <div style={{fontFamily:mono,color:C.green,fontWeight:800}}>{r[3]}</div>
            </div>
          ))}
        </div>
      </Chrome>
    </div>
  </AbsoluteFill>
};

const Approval: React.FC<{vertical:boolean}> = ({vertical}) => {
  const f=useCurrentFrame();
  const items=["Spend money","Publish publicly","Message a person as you"];
  return <AbsoluteFill style={{background:C.bg,color:C.text,fontFamily:sans,alignItems:"center",justifyContent:"center",padding:vertical?55:100}}>
    <Grid/>
    <div style={{maxWidth:vertical?920:1400,width:"100%",textAlign:"center"}}>
      <Kicker>The boundary</Kicker>
      <h2 style={{fontSize:vertical?78:84,lineHeight:.96,letterSpacing:"-.055em",margin:"16px auto 22px",maxWidth:1100}}>Automate the repetition.<br/>Not your judgment.</h2>
      <p style={{fontSize:vertical?26:22,color:C.muted,marginBottom:35}}>Anything consequential waits for you.</p>
      <div style={{display:"grid",gridTemplateColumns:vertical?"1fr":"repeat(3,1fr)",gap:14}}>
        {items.map((x,i)=>{
          const sp=spring({frame:f-25-i*13,fps:30,config:{damping:16,stiffness:130}});
          return <div key={x} style={{border:`1px solid ${C.line}`,background:C.panel,borderRadius:16,padding:vertical?"24px 26px":"26px 24px",display:"flex",alignItems:"center",gap:14,opacity:Math.max(0,Math.min(1,sp))}}>
            <div style={{width:34,height:34,borderRadius:99,border:`1px solid rgba(240,138,60,.4)`,display:"grid",placeItems:"center",color:C.accent,fontWeight:900}}>!</div>
            <div style={{fontSize:vertical?23:20,fontWeight:800,textAlign:"left"}}>{x}</div>
            <div style={{marginLeft:"auto",fontFamily:mono,fontSize:11,color:C.faint}}>APPROVAL</div>
          </div>
        })}
      </div>
      <div style={{marginTop:26,display:"inline-flex",alignItems:"center",gap:10,border:`1px solid rgba(63,224,129,.35)`,background:"rgba(63,224,129,.07)",padding:"13px 18px",borderRadius:999,color:C.green,fontWeight:800,fontSize:15}}>
        ✓ Founder stays in control
      </div>
    </div>
  </AbsoluteFill>
};

const End: React.FC<{vertical:boolean}> = ({vertical}) => {
  const f=useCurrentFrame();
  const s=spring({frame:f-4,fps:30,config:{damping:17,stiffness:110}});
  return <AbsoluteFill style={{background:C.bg,color:C.text,fontFamily:sans,alignItems:"center",justifyContent:"center",padding:vertical?55:100}}>
    <Grid/>
    <div style={{position:"relative",textAlign:"center",opacity:fade(f,0,16),transform:`scale(${.96+.04*s})`}}>
      <div style={{display:"flex",justifyContent:"center",marginBottom:26}}><Logo size={vertical?70:58}/></div>
      <h2 style={{fontSize:vertical?86:92,lineHeight:.96,letterSpacing:"-.06em",margin:0}}>Give Kryx the goal.</h2>
      <h2 style={{fontFamily:"Georgia, serif",fontWeight:400,fontStyle:"italic",fontSize:vertical?72:75,lineHeight:1,color:C.muted,margin:"10px 0 0"}}>Come back to finished work.</h2>
      <div style={{marginTop:42,fontFamily:mono,fontSize:vertical?24:20,color:C.accent,letterSpacing:".08em"}}>GETKRYXAI.COM</div>
      <div style={{marginTop:16,fontSize:vertical?20:16,color:C.muted}}>Research · Leads · SEO · Content · Conversion · Approval</div>
    </div>
  </AbsoluteFill>
};

export const KryxLaunch: React.FC<{vertical:boolean}> = ({vertical}) => {
  return (
    <AbsoluteFill style={{background:C.bg}}>
      <Sequence from={0} durationInFrames={120}><Intro vertical={vertical}/></Sequence>
      <Sequence from={120} durationInFrames={180}><Chaos vertical={vertical}/></Sequence>
      <Sequence from={300} durationInFrames={180}><OneGoal vertical={vertical}/></Sequence>
      <Sequence from={480} durationInFrames={330}><MissionControl vertical={vertical}/></Sequence>
      <Sequence from={810} durationInFrames={270}><Army vertical={vertical}/></Sequence>
      <Sequence from={1080} durationInFrames={210}><Leads vertical={vertical}/></Sequence>
      <Sequence from={1290} durationInFrames={180}><Approval vertical={vertical}/></Sequence>
      <Sequence from={1470} durationInFrames={150}><End vertical={vertical}/></Sequence>

      {[118,299,479,809,1079,1289,1469].map((at)=>(
        <Sequence key={at} from={at} durationInFrames={5}>
          <Audio src={CLICK} volume={0.35}/>
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
