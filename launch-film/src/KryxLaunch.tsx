import React from "react";
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const C = {
  bg: "#0b0a09",
  ink: "#11100f",
  surface: "#f8f6f1",
  surface2: "#f1eee8",
  line: "#d9d4ca",
  darkLine: "#37322c",
  text: "#151515",
  white: "#ffffff",
  muted: "#77716b",
  accent: "#e77829",
  green: "#1f9d61",
  greenWash: "#e8f6ee",
  orangeWash: "#fff1e6",
  telegram: "#2aabee",
};

const sans = "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const mono = "'SFMono-Regular', Menlo, Consolas, monospace";

const clamp = (n:number) => Math.max(0, Math.min(1, n));
const fade = (f:number,a:number,b:number) => clamp((f-a)/(b-a));
const lerp = (f:number,a:number,b:number,x:number,y:number) =>
  interpolate(f,[a,b],[x,y],{extrapolateLeft:"clamp",extrapolateRight:"clamp"});

const Cursor: React.FC<{x:number;y:number;click?:boolean}> = ({x,y,click}) => (
  <div style={{
    position:"absolute",left:x,top:y,width:26,height:34,zIndex:50,
    transform:`translate(-2px,-2px) scale(${click?.86:1})`,
    filter:"drop-shadow(0 2px 3px rgba(0,0,0,.25))"
  }}>
    <svg viewBox="0 0 24 32" width="26" height="34">
      <path d="M2 1 20 18l-8 1 5 9-4 2-5-9-6 6Z" fill="#fff" stroke="#111" strokeWidth="1.5"/>
    </svg>
  </div>
);

const Browser: React.FC<{children:React.ReactNode;scale?:number;rotate?:number;title?:string;style?:React.CSSProperties}> = ({children,scale=1,rotate=0,title="getkryxai.com",style}) => (
  <div style={{
    position:"relative",background:C.surface,border:`1px solid ${C.line}`,borderRadius:24,
    boxShadow:"0 38px 100px rgba(0,0,0,.24)",overflow:"hidden",
    transform:`perspective(1800px) rotateX(${rotate}deg) scale(${scale})`,transformOrigin:"center bottom",
    ...style,
  }}>
    <div style={{height:58,borderBottom:`1px solid ${C.line}`,display:"flex",alignItems:"center",padding:"0 18px",gap:8,background:"#fbfaf7"}}>
      <span style={{width:10,height:10,borderRadius:99,background:"#ff6b5f"}}/>
      <span style={{width:10,height:10,borderRadius:99,background:"#f4bd4f"}}/>
      <span style={{width:10,height:10,borderRadius:99,background:"#62c554"}}/>
      <div style={{margin:"0 auto",fontFamily:mono,fontSize:12,color:C.muted}}>{title}</div>
      <div style={{width:54}}/>
    </div>
    {children}
  </div>
);

const Logo: React.FC<{dark?:boolean;compact?:boolean}> = ({dark=false,compact=false}) => (
  <div style={{display:"flex",alignItems:"center",gap:compact?9:12,color:dark?C.white:C.text}}>
    <div style={{
      width:compact?30:40,height:compact?30:40,borderRadius:8,
      background:dark?C.white:C.ink,color:dark?C.ink:C.white,
      display:"grid",placeItems:"center",fontWeight:900,fontSize:compact?17:22
    }}>K</div>
    <div style={{fontWeight:850,fontSize:compact?18:26,letterSpacing:"-.04em"}}>KryxAI</div>
  </div>
);

const Sidebar: React.FC<{active:string}> = ({active}) => (
  <div style={{width:190,borderRight:`1px solid ${C.line}`,padding:18,background:"#faf8f4",fontFamily:sans}}>
    <Logo compact/>
    <div style={{marginTop:26,display:"grid",gap:6}}>
      {["Home","Mission Control","The room","Agents","Leads","Usage","Settings"].map((x)=>(
        <div key={x} style={{
          padding:"10px 12px",borderRadius:10,fontSize:13,fontWeight:650,
          background:active===x?C.ink:"transparent",color:active===x?C.white:"#666"
        }}>{x}</div>
      ))}
    </div>
  </div>
);

const OpeningScene: React.FC<{vertical:boolean}> = ({vertical}) => {
  const f=useCurrentFrame();
  const enter=spring({frame:f,fps:30,config:{damping:17,stiffness:88,mass:.9}});
  const open=spring({frame:f-18,fps:30,config:{damping:18,stiffness:105,mass:.8}});
  return <AbsoluteFill style={{background:"#ece8e0",fontFamily:sans,overflow:"hidden"}}>
    <div style={{position:"absolute",left:vertical?58:95,top:vertical?110:68,zIndex:10,opacity:fade(f,4,22)}}>
      <div style={{fontFamily:mono,fontSize:12,color:C.accent,letterSpacing:".16em"}}>INTRODUCING</div>
      <div style={{fontSize:vertical?72:72,fontWeight:850,letterSpacing:"-.055em",marginTop:8}}>KryxAI</div>
      <div style={{fontSize:vertical?28:24,color:C.muted,marginTop:8}}>Give it a goal. Keep the final say.</div>
    </div>
    <Browser style={{
      position:"absolute",
      left:vertical?52:120,right:vertical?52:120,
      top:vertical?330:160,bottom:vertical?100:60,
      transform:`perspective(1800px) translateY(${(1-enter)*520}px) rotateX(${(1-open)*28}deg) scale(${.58+.42*enter})`,
      transformOrigin:"center bottom",
    }}>
      <div style={{display:"flex",height:"calc(100% - 58px)"}}>
        <Sidebar active="Home"/>
        <div style={{flex:1,padding:24,background:C.surface}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div><div style={{fontSize:24,fontWeight:850}}>Morning brief</div><div style={{fontSize:12,color:C.muted,marginTop:3}}>Everything important since yesterday</div></div>
            <div style={{fontFamily:mono,fontSize:11,color:C.green}}>● 3 READY</div>
          </div>
          <div style={{marginTop:18,display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
            {[["Work ready","3"],["Needs you","2"],["In progress","2"],["Sources saved","7"]].map(([a,b])=><div key={a} style={{border:`1px solid ${C.line}`,borderRadius:12,padding:14,background:"#fff"}}><div style={{fontFamily:mono,fontSize:24,fontWeight:900}}>{b}</div><div style={{fontSize:11,color:C.muted,marginTop:5}}>{a}</div></div>)}
          </div>
          <div style={{marginTop:14,display:"grid",gridTemplateColumns:"1.2fr .8fr",gap:12}}>
            <div style={{border:`1px solid ${C.line}`,borderRadius:14,padding:16,background:"#fff"}}>
              <div style={{fontSize:12,fontWeight:850,color:C.muted}}>NEEDS YOU</div>
              {["Approve founder outreach draft","Review homepage opener"].map((x,i)=><div key={x} style={{marginTop:12,border:`1px solid ${i===0?C.accent:C.line}`,borderRadius:10,padding:12,fontSize:13,fontWeight:760}}>{x}<div style={{fontSize:10,color:C.muted,marginTop:6}}>evidence attached</div></div>)}
            </div>
            <div style={{border:`1px solid ${C.line}`,borderRadius:14,padding:16,background:"#fff"}}>
              <div style={{fontSize:12,fontWeight:850,color:C.muted}}>TEAM</div>
              {["Research","Search","Pipeline","Content"].map(x=><div key={x} style={{display:"flex",justifyContent:"space-between",padding:"10px 0",borderBottom:`1px solid ${C.line}`,fontSize:12}}><span>{x}</span><span style={{color:C.green}}>running</span></div>)}
            </div>
          </div>
        </div>
      </div>
    </Browser>
  </AbsoluteFill>;
};

const SetupScene: React.FC<{vertical:boolean}> = ({vertical}) => {
  const f=useCurrentFrame();
  const enter=spring({frame:f,fps:30,config:{damping:18,stiffness:95,mass:.85}});
  const step=Math.min(4,Math.floor(Math.max(0,f-50)/35));
  const labels=[
    ["What do you want to call your head agent?","Kryx"],
    ["When should Kryx message you?","09:00 · Asia/Kolkata"],
    ["What is your website?","getkryxai.com"],
    ["Who is your customer?","SaaS founders doing marketing themselves"],
    ["Ready","Deploy the whole team"],
  ];
  const x=vertical?58:235;
  const y=vertical?180:112;
  const w=vertical?964:1450;
  const h=vertical?1420:820;
  return <AbsoluteFill style={{background:"#eeeae2",fontFamily:sans}}>
    <div style={{position:"absolute",left:"50%",top:"50%",width:w,height:h,
      transform:`translate(-50%,-50%) translateY(${(1-enter)*420}px) scale(${.72+.28*enter}) perspective(1800px) rotateX(${(1-enter)*18}deg)`,
      opacity:fade(f,0,16)}}>
      <Browser style={{width:"100%",height:"100%"}}>
        <div style={{display:"flex",height:"calc(100% - 58px)"}}>
          <Sidebar active="Home"/>
          <div style={{flex:1,padding:vertical?48:54,background:C.surface}}>
            <div style={{fontFamily:mono,fontSize:11,color:C.accent,letterSpacing:".14em",textTransform:"uppercase"}}>Setup your army</div>
            <div style={{display:"flex",gap:7,marginTop:12}}>
              {[0,1,2,3,4].map(i=><span key={i} style={{height:5,flex:1,borderRadius:99,background:i<=step?C.accent:"#ded8cf"}}/> )}
            </div>
            <div style={{marginTop:vertical?130:90,maxWidth:860}}>
              <h2 style={{margin:0,fontSize:vertical?52:58,lineHeight:1.03,letterSpacing:"-.045em",color:C.text}}>
                {labels[step][0]}
              </h2>
              <div style={{marginTop:28,border:`1px solid ${step===4?C.accent:C.line}`,background:"#fff",borderRadius:16,padding:"22px 24px",fontSize:vertical?28:24,fontWeight:700,color:step===4?C.accent:C.text}}>
                {labels[step][1]}
              </div>
              <p style={{marginTop:18,color:C.muted,fontSize:17,lineHeight:1.5}}>
                One answer at a time. Kryx uses this context before any specialist starts work.
              </p>
            </div>
          </div>
        </div>
      </Browser>
    </div>
    <div style={{position:"absolute",left:x,top:y,opacity:fade(f,12,28)}}>
      <div style={{fontFamily:mono,fontSize:12,color:"#777",letterSpacing:".12em"}}>INTRODUCING KRYXAI</div>
    </div>
  </AbsoluteFill>;
};

const ChatScene: React.FC<{vertical:boolean}> = ({vertical}) => {
  const f=useCurrentFrame();
  const typed="Every weekday at 8am, find 20 SaaS founders who match my ICP, draft outreach, and ask me before anything sends.";
  const n=Math.floor(lerp(f,32,118,0,typed.length));
  const sent=f>125;
  const reply=f>155;
  return <AbsoluteFill style={{background:"#e9e5dd",fontFamily:sans}}>
    <Browser style={{position:"absolute",left:vertical?48:155,right:vertical?48:155,top:vertical?140:70,bottom:vertical?140:70}}>
      <div style={{display:"flex",height:"calc(100% - 58px)"}}>
        <Sidebar active="The room"/>
        <div style={{flex:1,display:"flex",flexDirection:"column",background:C.surface}}>
          <div style={{padding:"20px 24px",borderBottom:`1px solid ${C.line}`}}>
            <div style={{fontWeight:850,fontSize:20}}>Kryx</div>
            <div style={{color:C.muted,fontSize:12,marginTop:3}}>Head agent · online</div>
          </div>
          <div style={{flex:1,padding:28,display:"flex",flexDirection:"column",justifyContent:"flex-end",gap:14}}>
            {sent && <div style={{alignSelf:"flex-end",maxWidth:"75%",background:C.ink,color:C.white,borderRadius:"18px 18px 5px 18px",padding:"16px 18px",fontSize:17,lineHeight:1.45}}>
              {typed}
            </div>}
            {reply && <div style={{alignSelf:"flex-start",maxWidth:"78%",border:`1px solid ${C.line}`,background:"#fff",borderRadius:"18px 18px 18px 5px",padding:"16px 18px",fontSize:17,lineHeight:1.48,color:C.text}}>
              Scheduled. Rook will find and filter the accounts. Dex will draft one message per qualified lead. Anything outbound stays in <b>Needs you</b> until you approve it.
              <div style={{marginTop:10,fontFamily:mono,fontSize:11,color:C.green}}>✓ WEEKDAYS · 08:00 · APPROVAL REQUIRED</div>
            </div>}
          </div>
          <div style={{padding:18,borderTop:`1px solid ${C.line}`}}>
            <div style={{border:`1px solid ${C.line}`,background:"#fff",borderRadius:14,padding:"15px 18px",fontSize:16,color:C.text,minHeight:54}}>
              {!sent ? typed.slice(0,n) : "Message Kryx…"}{!sent && <span style={{opacity:.55}}>|</span>}
            </div>
          </div>
        </div>
      </div>
    </Browser>
    <Cursor x={vertical?900:1590} y={vertical?1700:930} click={f>120&&f<128}/>
  </AbsoluteFill>;
};

const MissionScene: React.FC<{vertical:boolean}> = ({vertical}) => {
  const f=useCurrentFrame();
  const approved=f>205;
  const pulse=spring({frame:f-36,fps:30,config:{damping:16,stiffness:100}});
  const lanes=[
    ["Needs you",["Cold email to Priya Raman","Homepage opener rewrite","Competitor demo-gate decision"]],
    ["In flight",["Finding practice owners","Reading pricing pages"]],
    ["Queued",["Thursday launch post","Weekly search audit"]],
    ["Done today",["18 cold emails written","Market brief saved"]],
  ];
  return <AbsoluteFill style={{background:"#e9e5dd",fontFamily:sans}}>
    <Browser style={{position:"absolute",left:vertical?42:95,right:vertical?42:95,top:vertical?100:55,bottom:vertical?100:55}}>
      <div style={{display:"flex",height:"calc(100% - 58px)"}}>
        <Sidebar active="Mission Control"/>
        <div style={{flex:1,padding:26,background:C.surface,overflow:"hidden"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"end"}}>
            <div><div style={{fontSize:28,fontWeight:850}}>Mission Control</div><div style={{fontSize:13,color:C.muted,marginTop:4}}>3 things are waiting on you. Everything else is running.</div></div>
            <div style={{fontFamily:mono,fontSize:11,color:C.green}}>● LIVE</div>
          </div>
          <div style={{marginTop:22,display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
            {lanes.map(([lane,cards],li)=>(
              <div key={lane as string} style={{border:`1px solid ${C.line}`,borderRadius:14,padding:10,background:"#fbfaf7",minHeight:560}}>
                <div style={{fontSize:13,fontWeight:800,color:C.muted,padding:"5px 5px 10px"}}>{lane} <span style={{fontFamily:mono}}>{(cards as string[]).length}</span></div>
                {(cards as string[]).map((c,ci)=>{
                  const isFirst=li===0&&ci===0;
                  const move=approved&&isFirst;
                  return <div key={c} style={{
                    marginBottom:9,border:`1px solid ${move?C.green:isFirst?C.accent:C.line}`,borderRadius:12,
                    padding:12,background:move?C.greenWash:"#fff",
                    transform:isFirst?`translateY(${(1-pulse)*18}px)`:"none",
                    opacity:isFirst ? .45 + .55*pulse : 1
                  }}>
                    {isFirst && <div style={{fontSize:10,fontWeight:850,color:move?C.green:C.accent,marginBottom:6}}>{move?"APPROVED":"NEEDS YOUR APPROVAL"}</div>}
                    <div style={{fontSize:13,fontWeight:760,lineHeight:1.25}}>{c}</div>
                    <div style={{fontSize:11,color:C.muted,marginTop:8}}>{li===1?"working now":li===2?"scheduled":li===3?"receipt saved":"evidence attached"}</div>
                  </div>
                })}
              </div>
            ))}
          </div>
          <div style={{display:"flex",justifyContent:"flex-end",gap:10,marginTop:12}}>
            <button style={{border:`1px solid ${C.line}`,background:"#fff",padding:"10px 14px",borderRadius:10,fontWeight:750}}>Ask Kryx</button>
            <button style={{border:0,background:approved?C.green:C.ink,color:"#fff",padding:"10px 16px",borderRadius:10,fontWeight:800}}>{approved?"Approved ✓":"Approve"}</button>
          </div>
        </div>
      </div>
    </Browser>
    <Cursor x={vertical?900:1690} y={vertical?1720:958} click={f>195&&f<210}/>
  </AbsoluteFill>;
};

const NetworkScene: React.FC<{vertical:boolean}> = ({vertical}) => {
  const f=useCurrentFrame();
  const {width,height}=useVideoConfig();
  const cx=width/2,cy=height/2;
  const names=["Research","Leads","SEO","Content","Conversion","Outreach","Analytics"];
  const burst=spring({frame:f-15,fps:30,config:{damping:13,stiffness:92,mass:.8}});
  const collapse=1-spring({frame:f-190,fps:30,config:{damping:15,stiffness:100}});
  const amount=Math.min(burst,collapse);
  const radius=(vertical?360:330)*amount;
  return <AbsoluteFill style={{background:C.surface,fontFamily:sans,color:C.text,overflow:"hidden"}}>
    <div style={{position:"absolute",inset:0,backgroundImage:"radial-gradient(circle at center, rgba(231,120,41,.13), transparent 42%)"}}/>
    <svg style={{position:"absolute",inset:0,width:"100%",height:"100%"}}>
      {names.map((_,i)=>{
        const a=(Math.PI*2*i/names.length)-Math.PI/2;
        const x=cx+Math.cos(a)*radius,y=cy+Math.sin(a)*radius;
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(20,20,20,.20)" strokeWidth="2"/>
      })}
      <circle cx={cx} cy={cy} r={78+10*Math.sin(f/8)} fill="rgba(231,120,41,.10)" stroke={C.accent} strokeWidth="2"/>
    </svg>
    <div style={{position:"absolute",left:cx,top:cy,transform:"translate(-50%,-50%)",textAlign:"center"}}>
      <div style={{fontWeight:900,fontSize:34}}>Kryx</div><div style={{fontFamily:mono,fontSize:11,color:C.accent,marginTop:5}}>HEAD AGENT</div>
    </div>
    {names.map((n,i)=>{
      const a=(Math.PI*2*i/names.length)-Math.PI/2;
      const x=cx+Math.cos(a)*radius,y=cy+Math.sin(a)*radius;
      return <div key={n} style={{position:"absolute",left:x,top:y,transform:"translate(-50%,-50%)",width:vertical?180:170,textAlign:"center"}}>
        <div style={{margin:"0 auto",width:62,height:62,borderRadius:20,border:`1px solid ${C.line}`,background:"#fff",display:"grid",placeItems:"center",fontSize:23}}>✦</div>
        <div style={{marginTop:10,fontSize:15,fontWeight:800}}>{n}</div>
      </div>
    })}
    <div style={{position:"absolute",left:"50%",top:vertical?120:72,transform:"translateX(-50%)",textAlign:"center"}}>
      <div style={{fontFamily:mono,fontSize:12,letterSpacing:".15em",color:"#999"}}>ONE GOAL · COORDINATED WORK</div>
      <div style={{fontSize:vertical?52:48,fontWeight:780,letterSpacing:"-.04em",marginTop:10}}>Kryx delegates. Specialists do the work.</div>
    </div>
  </AbsoluteFill>;
};

const ResultsScene: React.FC<{vertical:boolean}> = ({vertical}) => {
  const f=useCurrentFrame();
  const found=Math.round(lerp(f,35,125,0,41));
  const kept=Math.round(lerp(f,35,125,0,18));
  const sources=Math.round(lerp(f,55,125,0,7));
  return <AbsoluteFill style={{background:"#ece8e0",fontFamily:sans}}>
    <Browser style={{position:"absolute",left:vertical?48:140,right:vertical?48:140,top:vertical?140:80,bottom:vertical?140:80}}>
      <div style={{display:"flex",height:"calc(100% - 58px)"}}>
        <Sidebar active="Leads"/>
        <div style={{flex:1,padding:30,background:C.surface}}>
          <div style={{fontFamily:mono,fontSize:11,color:C.accent,letterSpacing:".12em"}}>RECEIPTS, NOT ACTIVITY</div>
          <h2 style={{fontSize:44,letterSpacing:"-.04em",margin:"8px 0 24px"}}>See what actually came back.</h2>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
            {[["FOUND",found,C.text],["KEPT",kept,C.green],["SOURCES SAVED",sources,C.accent]].map(([label,val,color])=><div key={label as string} style={{border:`1px solid ${C.line}`,borderRadius:14,padding:18,background:"#fff"}}>
              <div style={{fontFamily:mono,fontSize:11,color:C.muted}}>{label}</div>
              <div style={{fontFamily:mono,fontWeight:900,fontSize:46,color:color as string,marginTop:8}}>{val}</div>
            </div>)}
          </div>
          <div style={{marginTop:18,border:`1px solid ${C.line}`,borderRadius:14,overflow:"hidden"}}>
            {[
              ["Priya Raman","Practice Owner · Elmwood Dental","6 chairs · hiring a treatment coordinator","9"],
              ["Tom Whitfield","Managing Partner · Harbour Dental","two sites · paper scheduling","8"],
              ["Sinead Kelly","Owner · Rathmines Dental","new owner · software change signal","8"],
            ].map(r=><div key={r[0]} style={{display:"grid",gridTemplateColumns:"1.1fr 1.1fr 1.5fr .3fr",gap:12,padding:"15px 16px",borderBottom:`1px solid ${C.line}`,fontSize:13}}>
              <b>{r[0]}</b><span style={{color:C.muted}}>{r[1]}</span><span style={{color:C.muted}}>{r[2]}</span><b style={{fontFamily:mono,color:C.green}}>{r[3]}</b>
            </div>)}
          </div>
        </div>
      </div>
    </Browser>
  </AbsoluteFill>;
};

const TelegramScene: React.FC<{vertical:boolean}> = ({vertical}) => {
  const f=useCurrentFrame();
  const show2=f>70,show3=f>135;
  return <AbsoluteFill style={{background:"#eae6de",fontFamily:sans}}>
    <div style={{position:"absolute",left:vertical?60:170,top:vertical?140:120}}>
      <div style={{fontFamily:mono,fontSize:12,color:C.accent,letterSpacing:".14em"}}>AWAY FROM THE DASHBOARD</div>
      <h2 style={{fontSize:vertical?64:64,lineHeight:1,letterSpacing:"-.045em",margin:"12px 0 14px",maxWidth:vertical?900:700}}>Your head agent can report on Telegram.</h2>
      <p style={{fontSize:20,color:C.muted,maxWidth:620,lineHeight:1.5}}>Read the brief, ask for detail, approve work — from your phone.</p>
    </div>
    <div style={{
      position:"absolute",right:vertical?90:220,bottom:vertical?130:75,width:vertical?760:530,height:vertical?1070:790,
      border:"10px solid #161616",borderRadius:48,background:"#dfeaf2",overflow:"hidden",boxShadow:"0 30px 80px rgba(0,0,0,.24)",
      transform:`rotate(${vertical?0:-3}deg)`
    }}>
      <div style={{height:68,background:C.telegram,color:"#fff",display:"flex",alignItems:"center",padding:"0 20px",gap:12}}>
        <div style={{width:38,height:38,borderRadius:99,background:"#fff",color:C.telegram,display:"grid",placeItems:"center",fontWeight:900}}>K</div>
        <div><div style={{fontWeight:800}}>Kryx</div><div style={{fontSize:11,opacity:.82}}>bot</div></div>
      </div>
      <div style={{padding:18,display:"flex",flexDirection:"column",gap:12}}>
        <div style={{alignSelf:"flex-start",maxWidth:"86%",background:"#fff",borderRadius:"16px 16px 16px 5px",padding:14,fontSize:14,lineHeight:1.45}}>
          Morning brief: 18 qualified leads kept. 2 drafts need approval. One competitor changed pricing overnight.
          <div style={{fontSize:10,color:"#999",marginTop:5}}>09:00</div>
        </div>
        {show2&&<div style={{alignSelf:"flex-end",background:"#d6f4c6",borderRadius:"16px 16px 5px 16px",padding:"12px 14px",fontSize:14}}>2<div style={{fontSize:10,color:"#79906f",marginTop:4}}>09:01</div></div>}
        {show2&&<div style={{alignSelf:"flex-start",maxWidth:"86%",background:"#fff",borderRadius:"16px 16px 16px 5px",padding:14,fontSize:14,lineHeight:1.45}}>
          Drafts ready: 12 outreach messages + homepage opener rewrite. Reply <b>1</b> to approve all, or open Mission Control for each item.
        </div>}
        {show3&&<div style={{alignSelf:"flex-end",background:"#d6f4c6",borderRadius:"16px 16px 5px 16px",padding:"12px 14px",fontSize:14}}>status</div>}
        {show3&&<div style={{alignSelf:"flex-start",maxWidth:"86%",background:"#fff",borderRadius:"16px 16px 16px 5px",padding:14,fontSize:14,lineHeight:1.45}}>
          Research running · Search queued · Pipeline active · 2 decisions waiting on you.
        </div>}
      </div>
    </div>
  </AbsoluteFill>;
};

const PricingScene: React.FC<{vertical:boolean}> = ({vertical}) => {
  const f=useCurrentFrame();
  const s=spring({frame:f-8,fps:30,config:{damping:18,stiffness:90}});
  return <AbsoluteFill style={{background:C.surface,fontFamily:sans,color:C.text,padding:vertical?"130px 70px":"95px 150px"}}>
    <div style={{display:"grid",gridTemplateColumns:vertical?"1fr":"0.8fr 1.2fr",gap:vertical?60:110,alignItems:"center",height:"100%",opacity:fade(f,0,18),transform:`scale(${.97+.03*s})`}}>
      <div>
        <div style={{fontFamily:mono,fontSize:12,color:C.accent,letterSpacing:".14em"}}>PRICING</div>
        <div style={{fontSize:vertical?110:104,fontWeight:820,letterSpacing:"-.06em",marginTop:14}}>$0 <span style={{fontSize:30,color:C.muted}}>/ month</span></div>
        <p style={{fontSize:22,color:C.muted,lineHeight:1.5,maxWidth:600,marginTop:18}}>Planning, chat and review have no seat fee. Specialist work spends visible credits.</p>
        <div style={{marginTop:28,display:"grid",gap:10,fontSize:17}}>
          {["100 credits when you sign up","No card to start","100 credits = $1","Top up from $5","Credits pause work before balance goes negative"].map(x=><div key={x}>✓ {x}</div>)}
        </div>
      </div>
      <div style={{borderTop:`1px solid ${C.line}`}}>
        {[
          ["Draft or rewrite","5 cr"],
          ["Page read","3 cr"],
          ["Web search","6 cr"],
          ["Qualified lead search","30 cr"],
          ["Morning or evening brief","3 cr"],
        ].map(r=><div key={r[0]} style={{display:"flex",justifyContent:"space-between",padding:"19px 0",borderBottom:`1px solid ${C.line}`,fontSize:18}}>
          <b>{r[0]}</b><span style={{fontFamily:mono}}>{r[1]}</span>
        </div>)}
      </div>
    </div>
  </AbsoluteFill>;
};

const EndScene: React.FC<{vertical:boolean}> = ({vertical}) => {
  const f=useCurrentFrame();
  const enter=spring({frame:f,fps:30,config:{damping:18,stiffness:88}});
  return <AbsoluteFill style={{background:C.surface,fontFamily:sans,color:C.text}}>
    <div style={{position:"absolute",left:vertical?70:110,top:vertical?130:100,opacity:fade(f,0,18)}}>
      <Logo/>
      <h1 style={{fontSize:vertical?82:82,lineHeight:1.02,letterSpacing:"-.055em",fontWeight:580,margin:"95px 0 0",maxWidth:900}}>Give it a goal.<br/>Keep the final say.</h1>
      <div style={{marginTop:250,fontSize:22,fontWeight:800,borderBottom:`2px solid ${C.text}`,display:"inline-block",paddingBottom:10}}>getkryxai.com ↗</div>
    </div>
    <Browser style={{
      position:"absolute",right:vertical?-260:-120,bottom:vertical?-80:-170,width:vertical?980:1120,height:vertical?820:720,
      transform:`perspective(1800px) rotateX(7deg) rotateZ(-5deg) scale(${.82+.18*enter})`
    }}>
      <div style={{display:"flex",height:"calc(100% - 58px)"}}>
        <Sidebar active="Mission Control"/>
        <div style={{flex:1,padding:22,background:C.surface}}>
          <div style={{fontWeight:850,fontSize:22}}>Mission Control</div>
          <div style={{marginTop:15,display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
            {["Needs you","In flight","Queued","Done today"].map((x,i)=><div key={x} style={{border:`1px solid ${C.line}`,borderRadius:10,padding:8,minHeight:430}}>
              <div style={{fontSize:11,fontWeight:800,color:C.muted}}>{x}</div>
              {[0,1,2].slice(0,i===2?2:3).map(n=><div key={n} style={{marginTop:8,border:`1px solid ${i===0&&n===0?C.accent:C.line}`,borderRadius:8,padding:9,background:"#fff",height:76}}><div style={{height:8,width:"72%",background:"#d9d4ca",borderRadius:4}}/><div style={{height:7,width:"50%",background:"#e8e4de",borderRadius:4,marginTop:8}}/></div>)}
            </div>)}
          </div>
        </div>
      </div>
    </Browser>
  </AbsoluteFill>;
};

export const KryxLaunch: React.FC<{vertical:boolean}> = ({vertical}) => {
  return <AbsoluteFill style={{background:C.surface}}>
    <Sequence from={0} durationInFrames={120}><OpeningScene vertical={vertical}/></Sequence>
    <Sequence from={120} durationInFrames={180}><SetupScene vertical={vertical}/></Sequence>
    <Sequence from={300} durationInFrames={240}><ChatScene vertical={vertical}/></Sequence>
    <Sequence from={540} durationInFrames={300}><MissionScene vertical={vertical}/></Sequence>
    <Sequence from={840} durationInFrames={210}><NetworkScene vertical={vertical}/></Sequence>
    <Sequence from={1050} durationInFrames={210}><ResultsScene vertical={vertical}/></Sequence>
    <Sequence from={1260} durationInFrames={270}><TelegramScene vertical={vertical}/></Sequence>
    <Sequence from={1530} durationInFrames={210}><PricingScene vertical={vertical}/></Sequence>
    <Sequence from={1740} durationInFrames={270}><EndScene vertical={vertical}/></Sequence>
  </AbsoluteFill>;
};
