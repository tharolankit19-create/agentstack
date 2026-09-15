import React from 'react';
import {ding, mouseClick, uiSwitch, whoosh} from '@remotion/sfx';
import {
  AbsoluteFill,
  Html5Audio,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

const BG = '#07090d';
const INK = '#f7f8fb';
const MUTED = '#a8afbd';
const LINE = 'rgba(255,255,255,.11)';
const BLUE = '#7486ff';
const MINT = '#55deb1';
const PEACH = '#ffae78';
const RED = '#ff6d70';

const clamp = {extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const};

const rise = (frame: number, fps: number, delay = 0, distance = 34) => {
  const p = spring({frame: frame - delay, fps, config: {damping: 18, stiffness: 120, mass: .8}});
  return {
    opacity: interpolate(p, [0, 1], [0, 1], clamp),
    transform: `translateY(${interpolate(p, [0, 1], [distance, 0], clamp)}px)`,
  };
};

const sceneOpacity = (frame: number, duration: number, edge = 20) =>
  interpolate(frame, [0, edge, duration - edge, duration], [0, 1, 1, 0], clamp);

const glass: React.CSSProperties = {
  border: `1px solid ${LINE}`,
  background: 'linear-gradient(180deg,rgba(255,255,255,.085),rgba(255,255,255,.035))',
  boxShadow: '0 34px 110px rgba(0,0,0,.38), inset 0 1px 0 rgba(255,255,255,.12)',
  backdropFilter: 'blur(24px)',
};

const SceneBg: React.FC<{children: React.ReactNode; glow?: 'blue'|'mint'|'warm'}> = ({children, glow='blue'}) => {
  const color = glow === 'mint'
    ? 'rgba(74,222,179,.18)'
    : glow === 'warm'
      ? 'rgba(255,154,96,.18)'
      : 'rgba(116,134,255,.20)';
  return (
    <AbsoluteFill style={{
      background: BG,
      color: INK,
      fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
      overflow: 'hidden',
    }}>
      <div style={{
        position:'absolute',
        inset:0,
        background:`radial-gradient(circle at 50% 18%, ${color}, transparent 34%), radial-gradient(circle at 85% 85%, rgba(116,134,255,.10), transparent 28%), linear-gradient(180deg,#080a0f 0%,#05070a 100%)`,
      }} />
      <div style={{
        position:'absolute',
        inset:0,
        opacity:.12,
        backgroundImage:'linear-gradient(rgba(255,255,255,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.045) 1px,transparent 1px)',
        backgroundSize:'72px 72px',
        maskImage:'linear-gradient(to bottom,#000,transparent 78%)',
      }} />
      {children}
    </AbsoluteFill>
  );
};

const Logo: React.FC<{size?: number; showWord?: boolean}> = ({size=120, showWord=false}) => (
  <div style={{display:'flex',alignItems:'center',gap:24}}>
    <Img
      src={staticFile('brand/kryx-logo.jpg')}
      style={{
        width:size,
        height:size,
        objectFit:'cover',
        borderRadius:size*.22,
        boxShadow:'0 22px 80px rgba(0,0,0,.42)',
      }}
    />
    {showWord ? (
      <div style={{fontSize:size*.52,fontWeight:840,letterSpacing:'-.05em'}}>KryxAI</div>
    ) : null}
  </div>
);

const Pill: React.FC<{children: React.ReactNode; tone?: string}> = ({children,tone='rgba(255,255,255,.06)'}) => (
  <div style={{
    border:`1px solid ${LINE}`,
    background:tone,
    borderRadius:999,
    padding:'12px 18px',
    fontSize:22,
    fontWeight:650,
    color:'#dce1ea',
    whiteSpace:'nowrap',
  }}>
    {children}
  </div>
);

const Intro: React.FC<{duration: number}> = ({duration}) => {
  const frame=useCurrentFrame();
  const {fps}=useVideoConfig();
  const logo=rise(frame,fps,0,24);
  const title=rise(frame,fps,18,40);
  const sub=rise(frame,fps,34,28);
  const scale=interpolate(frame,[0,duration],[1.04,1],clamp);

  return (
    <SceneBg>
      <AbsoluteFill style={{
        alignItems:'center',
        justifyContent:'center',
        opacity:sceneOpacity(frame,duration),
        transform:`scale(${scale})`,
      }}>
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',textAlign:'center'}}>
          <div style={logo}><Logo size={132} /></div>
          <div style={{...title,marginTop:34,fontSize:34,fontWeight:720,letterSpacing:'.02em',color:'#c8ced8'}}>
            Introducing
          </div>
          <div style={{...title,marginTop:8,fontSize:108,lineHeight:.95,fontWeight:860,letterSpacing:'-.06em'}}>
            KryxAI
          </div>
          <div style={{...sub,marginTop:22,fontSize:38,fontWeight:650,letterSpacing:'-.025em',color:'#b9c1ce'}}>
            Your AI Head of Marketing.
          </div>
        </div>
      </AbsoluteFill>
    </SceneBg>
  );
};

const Problem: React.FC<{duration:number}> = ({duration}) => {
  const frame=useCurrentFrame();
  const {fps}=useVideoConfig();
  const words=['Research','SEO','Content','Leads','Analytics','Outreach'];
  const collapse=interpolate(frame,[150,250],[0,1],clamp);

  return (
    <SceneBg glow="warm">
      <AbsoluteFill style={{padding:'110px 120px',opacity:sceneOpacity(frame,duration)}}>
        <div style={{...rise(frame,fps,0),fontSize:30,fontWeight:720,color:MUTED}}>
          FOUNDERS SHOULDN&apos;T RUN THE MARKETING ORG THEMSELVES.
        </div>
        <div style={{marginTop:34,fontSize:84,lineHeight:1.02,fontWeight:850,letterSpacing:'-.055em',maxWidth:1260}}>
          One goal should not turn into six tabs, five tools, and a day of follow-up.
        </div>

        <div style={{position:'absolute',left:120,right:120,bottom:130,height:260}}>
          {words.map((word,index)=>{
            const inP=spring({frame:frame-(28+index*8),fps,config:{damping:16,stiffness:120}});
            const x=interpolate(collapse,[0,1],[index*250,620],clamp);
            const y=interpolate(collapse,[0,1],[index%2?110:0,72],clamp);
            const rotation=interpolate(collapse,[0,1],[index%2?2:-2,0],clamp);
            return (
              <div
                key={word}
                style={{
                  position:'absolute',
                  left:x,
                  top:y,
                  width:230,
                  height:126,
                  borderRadius:26,
                  ...glass,
                  display:'flex',
                  alignItems:'center',
                  justifyContent:'center',
                  fontSize:28,
                  fontWeight:760,
                  opacity:inP,
                  transform:`scale(${interpolate(inP,[0,1],[.9,1],clamp)}) rotate(${rotation}deg)`,
                }}
              >
                {word}
              </div>
            );
          })}

          <div style={{
            position:'absolute',
            left:500,
            top:38,
            width:650,
            height:190,
            borderRadius:34,
            border:`1px solid rgba(255,255,255,${.12*collapse})`,
            background:`rgba(255,255,255,${.05*collapse})`,
            opacity:collapse,
            display:'flex',
            alignItems:'center',
            padding:'0 34px',
            fontSize:30,
            fontWeight:720,
            boxShadow:'0 36px 100px rgba(0,0,0,.28)',
          }}>
            <span style={{color:'#8d96a8',marginRight:18}}>→</span>
            Give Kryx the outcome once.
          </div>
        </div>
      </AbsoluteFill>
    </SceneBg>
  );
};

const BrowserFrame: React.FC<{children: React.ReactNode}> = ({children}) => (
  <div style={{
    width:1500,
    height:790,
    borderRadius:34,
    ...glass,
    overflow:'hidden',
    background:'#f8f9fc',
    color:'#11151b',
  }}>
    <div style={{
      height:68,
      display:'flex',
      alignItems:'center',
      padding:'0 24px',
      borderBottom:'1px solid #e5e7ed',
      background:'#fff',
    }}>
      <div style={{display:'flex',gap:8}}>
        <i style={{width:12,height:12,borderRadius:9,background:'#ff6b67'}}/>
        <i style={{width:12,height:12,borderRadius:9,background:'#ffbf55'}}/>
        <i style={{width:12,height:12,borderRadius:9,background:'#49cc72'}}/>
      </div>
      <div style={{marginLeft:24,display:'flex',alignItems:'center',gap:12,fontWeight:800,fontSize:20}}>
        <span style={{
          width:32,
          height:32,
          borderRadius:10,
          background:'#0a0d12',
          display:'inline-flex',
          alignItems:'center',
          justifyContent:'center',
          color:'#fff',
        }}>
          K
        </span>
        KryxAI
      </div>
      <div style={{marginLeft:'auto',fontSize:15,color:'#818897'}}>DEMO WORKSPACE</div>
    </div>
    {children}
  </div>
);

const CommandScene: React.FC<{duration:number}> = ({duration}) => {
  const frame=useCurrentFrame();
  const {fps}=useVideoConfig();
  const prompt='Find why signup conversion dropped. Check competitor changes. Draft the two best SEO pages. Don’t publish anything without me.';
  const chars=Math.floor(interpolate(frame,[52,240],[0,prompt.length],clamp));
  const send=spring({frame:frame-245,fps,config:{damping:16,stiffness:140}});

  return (
    <SceneBg>
      <AbsoluteFill style={{alignItems:'center',justifyContent:'center',opacity:sceneOpacity(frame,duration)}}>
        <div style={{...rise(frame,fps,0),position:'absolute',top:66,left:210,fontSize:31,color:MUTED,fontWeight:700}}>
          ONE MESSAGE IN.
        </div>
        <BrowserFrame>
          <div style={{height:'100%',display:'grid',gridTemplateColumns:'260px 1fr'}}>
            <div style={{background:'#f0f2f7',borderRight:'1px solid #e2e5eb',padding:28}}>
              {['Dashboard','Mission Control','Agents','Room','Scheduled work'].map((item,index)=>(
                <div
                  key={item}
                  style={{
                    padding:'16px 14px',
                    borderRadius:14,
                    marginBottom:7,
                    fontSize:17,
                    fontWeight:index===0?760:560,
                    background:index===0?'#0b0e13':'transparent',
                    color:index===0?'#fff':'#59616e',
                  }}
                >
                  {item}
                </div>
              ))}
            </div>

            <div style={{padding:'62px 70px',position:'relative'}}>
              <div style={{display:'flex',alignItems:'center',gap:18}}>
                <div style={{
                  width:58,
                  height:58,
                  borderRadius:18,
                  background:'#0b0e13',
                  color:'#fff',
                  display:'grid',
                  placeItems:'center',
                  fontSize:28,
                }}>
                  ✦
                </div>
                <div>
                  <div style={{fontSize:24,fontWeight:820}}>Kryx</div>
                  <div style={{fontSize:15,color:'#7b8392'}}>Chief Marketing Leader</div>
                </div>
              </div>

              <div style={{
                marginTop:66,
                marginLeft:'auto',
                width:830,
                borderRadius:28,
                background:'#0b0e13',
                color:'#fff',
                padding:'28px 34px',
                fontSize:27,
                lineHeight:1.48,
                fontWeight:560,
                minHeight:165,
                boxShadow:'0 24px 60px rgba(0,0,0,.16)',
              }}>
                {prompt.slice(0,chars)}
                <span style={{opacity:frame%30<15?1:0,color:'#8ea0ff'}}>▍</span>
              </div>

              <div style={{
                position:'absolute',
                right:72,
                bottom:76,
                width:160,
                height:54,
                borderRadius:17,
                background:'#0b0e13',
                color:'#fff',
                display:'grid',
                placeItems:'center',
                fontSize:18,
                fontWeight:780,
                transform:`scale(${interpolate(send,[0,1],[.88,1],clamp)})`,
                opacity:send,
              }}>
                Send →
              </div>
            </div>
          </div>
        </BrowserFrame>
      </AbsoluteFill>
    </SceneBg>
  );
};

const AGENTS=[
  ['Ida','Market intelligence','⌕',BLUE],
  ['Vera','Growth analytics','↗',MINT],
  ['Otis','Content strategy','✎',PEACH],
  ['Wren','Search authority','⌁','#e3c247'],
  ['Nell','Conversion','◇',RED],
  ['Rook','Lead research','◎','#60a5fa'],
  ['Dex','Outreach','↗','#9a7cff'],
] as const;

const AgentCard: React.FC<{
  a: typeof AGENTS[number];
  index:number;
  frame:number;
  fps:number;
}> = ({a,index,frame,fps}) => {
  const p=spring({frame:frame-index*8,fps,config:{damping:16,stiffness:135}});

  return (
    <div style={{
      width:250,
      height:124,
      borderRadius:24,
      ...glass,
      display:'flex',
      alignItems:'center',
      gap:15,
      padding:'0 20px',
      opacity:p,
      transform:`translateY(${interpolate(p,[0,1],[30,0],clamp)}px) scale(${interpolate(p,[0,1],[.94,1],clamp)})`,
    }}>
      <div style={{
        width:50,
        height:50,
        borderRadius:16,
        background:`${a[3]}22`,
        color:a[3],
        border:`1px solid ${a[3]}45`,
        display:'grid',
        placeItems:'center',
        fontSize:27,
        fontWeight:800,
      }}>
        {a[2]}
      </div>
      <div>
        <div style={{fontSize:21,fontWeight:790}}>{a[0]}</div>
        <div style={{
          marginTop:4,
          fontSize:13,
          color:MUTED,
          textTransform:'uppercase',
          letterSpacing:'.08em',
        }}>
          {a[1]}
        </div>
      </div>
    </div>
  );
};

const DelegationScene: React.FC<{duration:number}> = ({duration}) => {
  const frame=useCurrentFrame();
  const {fps}=useVideoConfig();

  return (
    <SceneBg glow="mint">
      <AbsoluteFill style={{padding:'86px 100px',opacity:sceneOpacity(frame,duration)}}>
        <div style={{textAlign:'center',...rise(frame,fps,0)}}>
          <div style={{fontSize:28,fontWeight:740,color:MUTED}}>KRYX DELEGATES.</div>
          <div style={{marginTop:14,fontSize:72,fontWeight:850,letterSpacing:'-.05em'}}>
            Specialists execute in parallel.
          </div>
        </div>

        <svg
          width="1720"
          height="560"
          viewBox="0 0 1720 560"
          style={{position:'absolute',left:100,top:350,overflow:'visible',opacity:.85}}
        >
          {AGENTS.map((_,index)=>{
            const x=150+index*235;
            const progress=interpolate(frame,[70+index*5,210+index*5],[0,1],clamp);
            return (
              <path
                key={index}
                d={`M860 80 C860 170 ${x} 170 ${x} 300`}
                fill="none"
                stroke="rgba(116,134,255,.38)"
                strokeWidth="2"
                pathLength="1"
                strokeDasharray={`${progress} ${1-progress}`}
              />
            );
          })}
        </svg>

        <div style={{
          position:'absolute',
          left:805,
          top:290,
          width:310,
          height:150,
          borderRadius:34,
          ...glass,
          display:'flex',
          alignItems:'center',
          justifyContent:'center',
          gap:20,
          boxShadow:'0 38px 120px rgba(65,84,190,.24)',
        }}>
          <Logo size={78}/>
          <div>
            <div style={{fontSize:28,fontWeight:820}}>Kryx</div>
            <div style={{fontSize:15,color:MUTED}}>owns the outcome</div>
          </div>
        </div>

        <div style={{
          position:'absolute',
          left:90,
          right:90,
          bottom:95,
          display:'flex',
          gap:18,
          justifyContent:'space-between',
        }}>
          {AGENTS.map((agent,index)=>(
            <AgentCard
              key={agent[0]}
              a={agent}
              index={index}
              frame={frame-160}
              fps={fps}
            />
          ))}
        </div>
      </AbsoluteFill>
    </SceneBg>
  );
};

const MissionScene: React.FC<{duration:number}> = ({duration}) => {
  const frame=useCurrentFrame();
  const {fps}=useVideoConfig();
  const cards=[
    ['Pricing-page leak diagnosed','Kryx · decision','Review',BLUE],
    ['2 SEO pages drafted','Wren · draft','Approve',MINT],
    ['12 qualified accounts ready','Rook · research','Review',PEACH],
  ] as const;

  return (
    <SceneBg>
      <AbsoluteFill style={{padding:'92px 120px',opacity:sceneOpacity(frame,duration)}}>
        <div style={{...rise(frame,fps,0),fontSize:28,fontWeight:740,color:MUTED}}>
          MISSION CONTROL
        </div>
        <div style={{...rise(frame,fps,10),marginTop:12,fontSize:74,fontWeight:850,letterSpacing:'-.055em'}}>
          The team works. You keep the final say.
        </div>

        <div style={{marginTop:68,display:'grid',gridTemplateColumns:'1.25fr .75fr',gap:32}}>
          <div style={{borderRadius:32,...glass,overflow:'hidden'}}>
            <div style={{
              padding:'26px 28px',
              borderBottom:`1px solid ${LINE}`,
              display:'flex',
              justifyContent:'space-between',
            }}>
              <div style={{fontSize:22,fontWeight:800}}>Needs you</div>
              <Pill tone="rgba(116,134,255,.12)">3 items</Pill>
            </div>

            {cards.map((card,index)=>{
              const p=spring({frame:frame-(70+index*16),fps,config:{damping:18,stiffness:120}});
              return (
                <div
                  key={card[0]}
                  style={{
                    margin:'18px 22px',
                    borderRadius:22,
                    border:`1px solid ${LINE}`,
                    background:'rgba(255,255,255,.04)',
                    padding:'23px 24px',
                    display:'grid',
                    gridTemplateColumns:'1fr auto',
                    alignItems:'center',
                    opacity:p,
                    transform:`translateX(${interpolate(p,[0,1],[34,0],clamp)}px)`,
                  }}
                >
                  <div>
                    <div style={{fontSize:24,fontWeight:760}}>{card[0]}</div>
                    <div style={{marginTop:7,color:MUTED,fontSize:16}}>
                      {card[1]} · demo workspace
                    </div>
                  </div>
                  <div style={{
                    borderRadius:14,
                    border:`1px solid ${card[3]}66`,
                    background:`${card[3]}18`,
                    color:card[3],
                    padding:'12px 18px',
                    fontSize:15,
                    fontWeight:800,
                  }}>
                    {card[2]}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{
            borderRadius:32,
            ...glass,
            padding:'32px 30px',
            display:'flex',
            flexDirection:'column',
            justifyContent:'center',
          }}>
            <div style={{fontSize:16,fontWeight:800,color:MUTED,letterSpacing:'.14em'}}>
              FOUNDER CONTROL
            </div>
            <div style={{marginTop:18,fontSize:40,fontWeight:840,lineHeight:1.08}}>
              Nothing public, outbound, or irreversible moves without approval.
            </div>
            <div style={{marginTop:28,display:'flex',gap:12,flexWrap:'wrap'}}>
              <Pill>Publishing</Pill>
              <Pill>Outreach</Pill>
              <Pill>Spend</Pill>
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </SceneBg>
  );
};

const Bubble: React.FC<{who:string;text:string;right?:boolean}> = ({who,text,right}) => (
  <div style={{
    alignSelf:right?'flex-end':'flex-start',
    maxWidth:'82%',
    borderRadius:22,
    border:`1px solid ${LINE}`,
    background:right?'#f5f7fb':'rgba(255,255,255,.05)',
    color:right?'#11151b':INK,
    padding:'15px 18px',
  }}>
    <div style={{fontSize:13,fontWeight:820,opacity:.65}}>{who}</div>
    <div style={{marginTop:5,fontSize:17,lineHeight:1.42,fontWeight:570}}>{text}</div>
  </div>
);

const AlwaysOnScene: React.FC<{duration:number}> = ({duration}) => {
  const frame=useCurrentFrame();
  const {fps}=useVideoConfig();
  const notify=spring({frame:frame-210,fps,config:{damping:15,stiffness:150}});

  return (
    <SceneBg glow="warm">
      <AbsoluteFill style={{padding:'92px 110px',opacity:sceneOpacity(frame,duration)}}>
        <div style={{...rise(frame,fps,0),textAlign:'center'}}>
          <div style={{fontSize:28,fontWeight:740,color:MUTED}}>WHILE YOU BUILD</div>
          <div style={{marginTop:12,fontSize:74,fontWeight:850,letterSpacing:'-.055em'}}>
            Kryx keeps the marketing team moving.
          </div>
        </div>

        <div style={{marginTop:62,display:'grid',gridTemplateColumns:'1fr 1fr',gap:28}}>
          <div style={{height:500,borderRadius:32,...glass,padding:30}}>
            <div style={{fontSize:18,fontWeight:800,color:MUTED}}>SCHEDULED WORK</div>
            {[
              ['09:00','Morning brief','Kryx'],
              ['Daily','Competitor scan','Ida'],
              ['Weekly','Search opportunities','Wren'],
              ['Mon / Wed','Founder content','Otis'],
            ].map((row,index)=>{
              const p=spring({frame:frame-(55+index*13),fps,config:{damping:18,stiffness:120}});
              return (
                <div
                  key={row[1]}
                  style={{
                    marginTop:18,
                    border:`1px solid ${LINE}`,
                    borderRadius:19,
                    padding:'19px 20px',
                    display:'grid',
                    gridTemplateColumns:'110px 1fr 120px',
                    fontSize:18,
                    alignItems:'center',
                    opacity:p,
                    transform:`translateY(${interpolate(p,[0,1],[18,0],clamp)}px)`,
                  }}
                >
                  <span style={{color:'#c5cad4',fontWeight:700}}>{row[0]}</span>
                  <span style={{fontWeight:760}}>{row[1]}</span>
                  <span style={{color:MUTED,textAlign:'right'}}>{row[2]}</span>
                </div>
              );
            })}
          </div>

          <div style={{height:500,borderRadius:32,...glass,padding:30,position:'relative'}}>
            <div style={{fontSize:18,fontWeight:800,color:MUTED}}>THE ROOM</div>
            <div style={{marginTop:28,display:'flex',flexDirection:'column',gap:18}}>
              <Bubble who="You" text="@Kryx what changed today?" right/>
              <Bubble
                who="Kryx"
                text="One competitor shifted pricing. Wren found two queries worth a page. I queued both for your review."
              />
              <Bubble who="You" text="Schedule the scan every morning." right/>
            </div>
            <div style={{
              position:'absolute',
              right:26,
              bottom:24,
              left:26,
              border:`1px solid ${LINE}`,
              borderRadius:18,
              padding:'16px 18px',
              color:'#77808f',
            }}>
              Ask Kryx…
            </div>
          </div>
        </div>

        <div style={{
          position:'absolute',
          right:90,
          top:410,
          width:400,
          borderRadius:24,
          ...glass,
          padding:'22px 24px',
          opacity:notify,
          transform:`translateY(${interpolate(notify,[0,1],[22,0],clamp)}px) scale(${interpolate(notify,[0,1],[.94,1],clamp)})`,
        }}>
          <div style={{fontSize:15,color:MUTED,fontWeight:800}}>KRYX · 09:00</div>
          <div style={{marginTop:8,fontSize:20,fontWeight:780}}>
            Morning brief ready. 2 actions need you.
          </div>
        </div>
      </AbsoluteFill>
    </SceneBg>
  );
};

const PricingScene: React.FC<{duration:number}> = ({duration}) => {
  const frame=useCurrentFrame();
  const {fps}=useVideoConfig();

  return (
    <SceneBg glow="mint">
      <AbsoluteFill style={{padding:'110px 120px',opacity:sceneOpacity(frame,duration)}}>
        <div style={{
          display:'grid',
          gridTemplateColumns:'1.1fr .9fr',
          gap:80,
          alignItems:'center',
          height:'100%',
        }}>
          <div>
            <div style={{...rise(frame,fps,0),fontSize:30,fontWeight:740,color:MUTED}}>
              PAY FOR WORK. NOT SOFTWARE RENT.
            </div>
            <div style={{
              ...rise(frame,fps,12),
              marginTop:20,
              fontSize:116,
              fontWeight:870,
              letterSpacing:'-.07em',
              lineHeight:.92,
            }}>
              $0<span style={{fontSize:54,color:MUTED}}>/month</span>
            </div>
            <div style={{
              ...rise(frame,fps,22),
              marginTop:26,
              fontSize:39,
              fontWeight:700,
              lineHeight:1.2,
            }}>
              Start with 100 credits free.<br/>No card. No seat fee.
            </div>
            <div style={{
              ...rise(frame,fps,32),
              marginTop:24,
              fontSize:22,
              color:MUTED,
              lineHeight:1.55,
            }}>
              Purchased credits never expire. Top up from $5. Kryx chat stays free; specialist work uses credits.
            </div>
          </div>

          <div style={{borderRadius:38,...glass,padding:42}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <div style={{fontSize:16,fontWeight:800,color:MUTED,letterSpacing:'.12em'}}>
                  WORK BALANCE
                </div>
                <div style={{marginTop:8,fontSize:58,fontWeight:850}}>$5.00</div>
                <div style={{fontSize:17,color:MUTED}}>500 credits</div>
              </div>
              <div style={{
                width:132,
                height:58,
                borderRadius:18,
                background:'#fff',
                color:'#0c0f14',
                display:'grid',
                placeItems:'center',
                fontSize:18,
                fontWeight:820,
              }}>
                Buy credits
              </div>
            </div>
            <div style={{height:1,background:LINE,margin:'32px 0'}}/>
            {['No subscription','No agent fee','No seat fee','Credits never expire'].map((item,index)=>{
              const p=spring({frame:frame-(60+index*12),fps,config:{damping:18,stiffness:130}});
              return (
                <div
                  key={item}
                  style={{
                    display:'flex',
                    alignItems:'center',
                    gap:14,
                    marginTop:17,
                    fontSize:22,
                    fontWeight:680,
                    opacity:p,
                  }}
                >
                  <span style={{
                    width:28,
                    height:28,
                    borderRadius:999,
                    background:'rgba(85,222,177,.13)',
                    color:MINT,
                    display:'grid',
                    placeItems:'center',
                    fontSize:16,
                  }}>
                    ✓
                  </span>
                  {item}
                </div>
              );
            })}
          </div>
        </div>
      </AbsoluteFill>
    </SceneBg>
  );
};

const RealProductScene: React.FC<{duration:number}> = ({duration}) => {
  const frame=useCurrentFrame();
  const zoom=interpolate(frame,[0,duration],[1.05,1.0],clamp);
  const second=interpolate(frame,[150,190],[0,1],clamp);

  return (
    <SceneBg>
      <AbsoluteFill style={{
        opacity:sceneOpacity(frame,duration),
        alignItems:'center',
        justifyContent:'center',
      }}>
        <div style={{
          position:'absolute',
          top:66,
          left:120,
          fontSize:28,
          fontWeight:760,
          color:MUTED,
        }}>
          REAL PRODUCT UI · BUILD-IN-PUBLIC FOOTAGE
        </div>
        <div style={{
          width:1590,
          height:800,
          borderRadius:34,
          overflow:'hidden',
          border:`1px solid ${LINE}`,
          boxShadow:'0 44px 140px rgba(0,0,0,.5)',
          transform:`scale(${zoom})`,
          position:'relative',
          background:'#fff',
        }}>
          <Img
            src={staticFile('brand/live-landing.jpg')}
            style={{
              position:'absolute',
              width:'100%',
              height:'100%',
              objectFit:'cover',
              objectPosition:'center 14%',
            }}
          />
          <Img
            src={staticFile('brand/live-flow.jpg')}
            style={{
              position:'absolute',
              width:'100%',
              height:'100%',
              objectFit:'cover',
              objectPosition:'center 14%',
              opacity:second,
              transform:`scale(${interpolate(second,[0,1],[1.02,1],clamp)})`,
            }}
          />
          <div style={{
            position:'absolute',
            left:28,
            bottom:26,
            borderRadius:999,
            background:'rgba(8,10,14,.78)',
            color:'#fff',
            padding:'11px 16px',
            fontSize:14,
            fontWeight:760,
            backdropFilter:'blur(16px)',
          }}>
            Captured from the current KryxAI build
          </div>
        </div>
      </AbsoluteFill>
    </SceneBg>
  );
};

const EndCard: React.FC<{duration:number}> = ({duration}) => {
  const frame=useCurrentFrame();
  const {fps}=useVideoConfig();
  const p=spring({frame,fps,config:{damping:17,stiffness:120}});

  return (
    <SceneBg>
      <AbsoluteFill style={{
        alignItems:'center',
        justifyContent:'center',
        opacity:sceneOpacity(frame,duration,14),
      }}>
        <div style={{
          display:'flex',
          flexDirection:'column',
          alignItems:'center',
          textAlign:'center',
          transform:`scale(${interpolate(p,[0,1],[.94,1],clamp)})`,
          opacity:p,
        }}>
          <Logo size={126} showWord/>
          <div style={{marginTop:40,fontSize:72,fontWeight:850,letterSpacing:'-.055em'}}>
            Give Kryx the goal.
          </div>
          <div style={{marginTop:10,fontSize:36,color:MUTED,fontWeight:650}}>
            Your marketing team handles the rest.
          </div>
          <div style={{
            marginTop:42,
            borderRadius:20,
            background:'#fff',
            color:'#0b0e13',
            padding:'18px 28px',
            fontSize:24,
            fontWeight:840,
          }}>
            Start free → getkryxai.com
          </div>
          <div style={{marginTop:22,fontSize:17,color:'#7d8594'}}>
            $0/month · 100 credits included · no card
          </div>
        </div>
      </AbsoluteFill>
    </SceneBg>
  );
};

const Sfx: React.FC = () => (
  <>
    <Sequence from={2}><Html5Audio src={whoosh} volume={.55}/></Sequence>
    <Sequence from={200}><Html5Audio src={mouseClick} volume={.55}/></Sequence>
    <Sequence from={495}><Html5Audio src={whoosh} volume={.48}/></Sequence>
    <Sequence from={785}><Html5Audio src={mouseClick} volume={.6}/></Sequence>
    <Sequence from={915}><Html5Audio src={uiSwitch} volume={.46}/></Sequence>
    <Sequence from={1120}><Html5Audio src={uiSwitch} volume={.42}/></Sequence>
    <Sequence from={1432}><Html5Audio src={whoosh} volume={.45}/></Sequence>
    <Sequence from={1675}><Html5Audio src={mouseClick} volume={.52}/></Sequence>
    <Sequence from={2080}><Html5Audio src={ding} volume={.38}/></Sequence>
    <Sequence from={2380}><Html5Audio src={whoosh} volume={.48}/></Sequence>
    <Sequence from={2760}><Html5Audio src={mouseClick} volume={.5}/></Sequence>
    <Sequence from={3050}><Html5Audio src={ding} volume={.34}/></Sequence>
  </>
);

export const KryxLaunch: React.FC = () => (
  <AbsoluteFill style={{background:BG}}>
    <Sequence from={0} durationInFrames={240}><Intro duration={240}/></Sequence>
    <Sequence from={220} durationInFrames={300}><Problem duration={300}/></Sequence>
    <Sequence from={500} durationInFrames={440}><CommandScene duration={440}/></Sequence>
    <Sequence from={920} durationInFrames={520}><DelegationScene duration={520}/></Sequence>
    <Sequence from={1420} durationInFrames={480}><MissionScene duration={480}/></Sequence>
    <Sequence from={1880} durationInFrames={500}><AlwaysOnScene duration={500}/></Sequence>
    <Sequence from={2360} durationInFrames={430}><PricingScene duration={430}/></Sequence>
    <Sequence from={2770} durationInFrames={320}><RealProductScene duration={320}/></Sequence>
    <Sequence from={3070} durationInFrames={290}><EndCard duration={290}/></Sequence>
    <Sfx/>
  </AbsoluteFill>
);
