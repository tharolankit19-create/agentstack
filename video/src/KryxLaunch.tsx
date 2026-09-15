import React from "react";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/instrument-sans";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {SFX} from "./sfx";

const C = {
  bg: "#0b0a09",
  bg2: "#121110",
  surface: "#191715",
  line: "#342f29",
  fg: "#ffffff",
  text: "#ede9e3",
  muted: "#9b938a",
  faint: "#6b645c",
  accent: "#f08a3c",
  green: "#3fe081",
  red: "#ff5f57",
  amber: "#ffb224",
};

const display: React.CSSProperties = {
  fontFamily: '"Bricolage Grotesque Variable", sans-serif',
  letterSpacing: "-0.045em",
};
const body: React.CSSProperties = {
  fontFamily: '"Instrument Sans Variable", sans-serif',
};

const fade = (f: number, start: number, end: number) =>
  interpolate(f, [start, start + 14, end - 14, end], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

const Grid = () => (
  <AbsoluteFill
    style={{
      backgroundImage:
        "linear-gradient(rgba(255,255,255,.028) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.028) 1px, transparent 1px)",
      backgroundSize: "64px 64px",
      opacity: 0.7,
    }}
  />
);

const BrandMark = ({size = 62}: {size?: number}) => (
  <div
    style={{
      width: size,
      height: size,
      border: "1px solid " + C.line,
      display: "grid",
      placeItems: "center",
      background: C.surface,
      color: C.accent,
      fontSize: size * 0.42,
      fontWeight: 800,
      ...display,
    }}
  >
    K
  </div>
);

const BrowserShell = ({children}: {children: React.ReactNode}) => (
  <div
    style={{
      position: "absolute",
      left: 132,
      right: 132,
      top: 98,
      bottom: 98,
      border: "1px solid " + C.line,
      background: C.bg2,
      boxShadow: "0 35px 100px rgba(0,0,0,.55)",
      overflow: "hidden",
    }}
  >
    <div
      style={{
        height: 62,
        borderBottom: "1px solid " + C.line,
        display: "flex",
        alignItems: "center",
        padding: "0 22px",
        gap: 10,
        background: "#0e0d0c",
      }}
    >
      <span style={{width: 11, height: 11, borderRadius: 99, background: C.red}} />
      <span style={{width: 11, height: 11, borderRadius: 99, background: C.amber}} />
      <span style={{width: 11, height: 11, borderRadius: 99, background: C.green}} />
      <div
        style={{
          marginLeft: 26,
          border: "1px solid " + C.line,
          borderRadius: 8,
          padding: "10px 20px",
          color: C.muted,
          fontSize: 15,
          minWidth: 520,
        }}
      >
        getkryxai.com
      </div>
    </div>
    {children}
  </div>
);

const Cursor = ({x, y, click = false}: {x: number; y: number; click?: boolean}) => (
  <div style={{position: "absolute", left: x, top: y, width: 30, height: 30, zIndex: 20}}>
    <svg viewBox="0 0 24 24" width="30" height="30">
      <path d="M4 3l15 8-7 2-3 7z" fill="#fff" stroke="#000" strokeWidth="1.6" />
    </svg>
    {click ? (
      <span
        style={{
          position: "absolute",
          inset: -16,
          border: "2px solid rgba(240,138,60,.75)",
          borderRadius: 999,
        }}
      />
    ) : null}
  </div>
);

const Intro = () => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = spring({frame: f, fps, config: {damping: 18, stiffness: 120}});
  return (
    <AbsoluteFill style={{background: C.bg, color: C.fg, ...body}}>
      <Grid />
      <div style={{position: "absolute", inset: 0, display: "grid", placeItems: "center"}}>
        <div style={{textAlign: "center", transform: "scale(" + (0.92 + s * 0.08) + ")", opacity: s}}>
          <div style={{display: "flex", justifyContent: "center", marginBottom: 34}}><BrandMark size={72} /></div>
          <div style={{fontSize: 30, textTransform: "uppercase", letterSpacing: ".18em", color: C.muted}}>Introducing</div>
          <h1 style={{...display, fontSize: 132, lineHeight: 0.92, margin: "18px 0 0"}}>KryxAI</h1>
          <p style={{fontSize: 34, color: C.muted, marginTop: 30}}>Finished marketing work. Ready for approval.</p>
        </div>
      </div>
      <Audio src={SFX.whoosh} volume={0.32} />
    </AbsoluteFill>
  );
};

const Problem = () => {
  const f = useCurrentFrame();
  const items = ["research", "leads", "content", "follow-ups", "daily checks", "approvals"];
  return (
    <AbsoluteFill style={{background: C.bg, color: C.fg, ...body, opacity: fade(f, 0, 520)}}>
      <Grid />
      <div style={{padding: "120px 150px"}}>
        <p style={{fontSize: 24, textTransform: "uppercase", letterSpacing: ".16em", color: C.faint}}>The founder tax</p>
        <h2 style={{...display, fontSize: 82, maxWidth: 1250, lineHeight: 0.98, marginTop: 22}}>
          Marketing became six jobs<br />and seven tabs.
        </h2>
        <div style={{display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18, marginTop: 74}}>
          {items.map((item, i) => {
            const local = f - 45 - i * 22;
            const p = spring({frame: local, fps: 60, config: {damping: 17, stiffness: 130}});
            const y = interpolate(p, [0, 1], [42, 0]);
            return (
              <div
                key={item}
                style={{
                  border: "1px solid " + C.line,
                  background: C.bg2,
                  padding: "30px 34px",
                  transform: "translateY(" + y + "px)",
                  opacity: p,
                }}
              >
                <div style={{fontSize: 18, color: C.faint, marginBottom: 30}}>TAB 0{i + 1}</div>
                <div style={{fontSize: 30, fontWeight: 700}}>{item}</div>
              </div>
            );
          })}
        </div>
      </div>
      {[50, 72, 94, 116, 138, 160].map((at) => (
        <Sequence key={at} from={at} durationInFrames={6}><Audio src={SFX.tick} volume={0.18} /></Sequence>
      ))}
    </AbsoluteFill>
  );
};

const Thesis = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{background: C.bg, color: C.fg, ...body, opacity: fade(f, 0, 380)}}>
      <Grid />
      <div style={{position: "absolute", left: 150, right: 150, top: 180}}>
        <div style={{display: "flex", alignItems: "center", gap: 22}}>
          <BrandMark />
          <span style={{fontSize: 24, color: C.muted}}>one workspace · one head agent</span>
        </div>
        <h2 style={{...display, fontSize: 96, lineHeight: 0.96, maxWidth: 1320, marginTop: 52}}>
          You manage the outcome.<br />
          <span style={{color: C.accent}}>Kryx manages the work.</span>
        </h2>
        <p style={{fontSize: 33, color: C.muted, maxWidth: 1100, marginTop: 40, lineHeight: 1.45}}>
          Research, SEO, content and pipeline move forward on their own. Public, outbound or irreversible work waits for you.
        </p>
      </div>
      <Sequence from={38} durationInFrames={12}><Audio src={SFX.pop} volume={0.24} /></Sequence>
    </AbsoluteFill>
  );
};

const MissionControl = () => {
  const f = useCurrentFrame();
  const clickFrame = 260;
  const approved = f > clickFrame;
  const cursorX = interpolate(f, [110, 225, 260, 310], [1480, 1480, 1510, 1580], {extrapolateLeft: "clamp", extrapolateRight: "clamp"});
  const cursorY = interpolate(f, [110, 225, 260, 310], [480, 690, 690, 610], {extrapolateLeft: "clamp", extrapolateRight: "clamp"});
  const cards = [
    ["Needs you", "Approve competitor teardown", "Pricing page changed Tuesday · evidence attached", C.accent],
    ["In flight", "Score 41 accounts against ICP", "Live company data · filtering non-buyers", C.amber],
    ["Queued", "Rewrite page answer block", "Search evidence saved", C.muted],
    ["Done today", "18 qualified prospects ready", "Duplicates removed · list saved", C.green],
  ];
  return (
    <AbsoluteFill style={{background: C.bg, color: C.fg, ...body, opacity: fade(f, 0, 620)}}>
      <Grid />
      <BrowserShell>
        <div style={{padding: "28px 34px"}}>
          <div style={{display: "flex", justifyContent: "space-between", alignItems: "end"}}>
            <div>
              <div style={{fontSize: 14, color: C.faint, letterSpacing: ".14em", textTransform: "uppercase"}}>Mission Control</div>
              <h3 style={{...display, fontSize: 42, margin: "8px 0 0"}}>Finished work, not agent logs.</h3>
            </div>
            <div style={{fontSize: 16, color: C.green}}>● 3 ready</div>
          </div>
          <div style={{display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginTop: 26}}>
            {cards.map((card, i) => (
              <div key={card[0]} style={{border: "1px solid " + C.line, background: C.bg, padding: 18, minHeight: 290}}>
                <div style={{fontSize: 15, fontWeight: 700, marginBottom: 14}}>{card[0]}</div>
                <div style={{border: "1px solid " + (i === 0 && !approved ? C.accent : C.line), background: C.surface, padding: 17}}>
                  <div style={{fontSize: 12, color: card[3], fontWeight: 700, marginBottom: 10}}>
                    {i === 0 && !approved ? "NEEDS APPROVAL" : String(card[0]).toUpperCase()}
                  </div>
                  <div style={{fontSize: 18, lineHeight: 1.25, fontWeight: 700}}>
                    {i === 0 && approved ? "Competitor teardown approved" : card[1]}
                  </div>
                  <div style={{fontSize: 13, lineHeight: 1.45, color: C.muted, marginTop: 10}}>{card[2]}</div>
                </div>
              </div>
            ))}
          </div>
          <div
            style={{
              marginTop: 16,
              border: "1px solid " + (approved ? "rgba(63,224,129,.45)" : C.line),
              padding: "16px 18px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: C.surface,
            }}
          >
            <div>
              <div style={{fontSize: 11, color: C.faint}}>SELECTED MISSION</div>
              <div style={{fontSize: 17, fontWeight: 700, marginTop: 4}}>
                {approved ? "Approved. Kryx can continue." : "Approve competitor teardown"}
              </div>
            </div>
            <div style={{background: approved ? C.green : C.fg, color: C.bg, padding: "12px 20px", fontWeight: 800, borderRadius: 8}}>
              {approved ? "Approved ✓" : "Approve"}
            </div>
          </div>
        </div>
      </BrowserShell>
      <Cursor x={cursorX} y={cursorY} click={Math.abs(f - clickFrame) < 10} />
      <Sequence from={clickFrame} durationInFrames={8}><Audio src={SFX.success} volume={0.28} /></Sequence>
    </AbsoluteFill>
  );
};

const EvidenceRoom = () => {
  const f = useCurrentFrame();
  const rows = [
    ["06:52", "Competitor trial change found", "Pricing page changed Tuesday · source saved", "Evidence attached"],
    ["07:01", "Homepage problem isolated", "Answer appears four paragraphs too late", "Rewrite ready"],
    ["07:04", "18 prospects kept from 41 found", "Non-buyers removed before outreach", "List ready"],
  ];
  return (
    <AbsoluteFill style={{background: C.bg, color: C.fg, ...body, opacity: fade(f, 0, 520)}}>
      <Grid />
      <div style={{position: "absolute", left: 150, top: 120, width: 640}}>
        <p style={{fontSize: 20, color: C.faint, letterSpacing: ".14em"}}>MORNING BRIEF</p>
        <h2 style={{...display, fontSize: 72, lineHeight: 0.98, marginTop: 18}}>Every answer comes back with a receipt.</h2>
        <p style={{fontSize: 26, lineHeight: 1.5, color: C.muted, marginTop: 28}}>
          Kryx saves the source, the evidence and the decision it needs from you.
        </p>
      </div>
      <div style={{position: "absolute", right: 140, top: 140, width: 830, border: "1px solid " + C.line, background: C.bg2}}>
        <div style={{padding: "20px 24px", borderBottom: "1px solid " + C.line, display: "flex", justifyContent: "space-between"}}>
          <b>Morning brief</b><span style={{color: C.green}}>3 ready</span>
        </div>
        {rows.map((r, i) => {
          const p = spring({frame: f - 40 - i * 42, fps: 60, config: {damping: 18, stiffness: 120}});
          return (
            <div
              key={r[0]}
              style={{
                display: "grid",
                gridTemplateColumns: "80px 1fr",
                gap: 20,
                padding: 24,
                borderBottom: "1px solid " + C.line,
                opacity: p,
                transform: "translateX(" + (1 - p) * 30 + "px)",
              }}
            >
              <span style={{color: C.faint}}>{r[0]}</span>
              <div>
                <div style={{fontSize: 20, fontWeight: 700}}>{r[1]}</div>
                <div style={{marginTop: 7, color: C.muted}}>{r[2]}</div>
                <div style={{marginTop: 12, color: C.green, fontSize: 14}}>✓ {r[3]}</div>
              </div>
            </div>
          );
        })}
      </div>
      {[45, 87, 129].map((at) => (
        <Sequence key={at} from={at} durationInFrames={6}><Audio src={SFX.tick} volume={0.17} /></Sequence>
      ))}
    </AbsoluteFill>
  );
};

const Army = () => {
  const f = useCurrentFrame();
  const lanes = [
    ["RESEARCH", "live market + competitors", "Ida · Vera"],
    ["SEARCH & CONVERSION", "SEO + page fixes + CRO", "Wren · Nell"],
    ["PIPELINE", "qualified leads + outreach drafts", "Rook · Dex"],
  ];
  return (
    <AbsoluteFill style={{background: C.bg, color: C.fg, ...body, opacity: fade(f, 0, 520)}}>
      <Grid />
      <div style={{padding: "115px 150px"}}>
        <div style={{display: "flex", alignItems: "end", justifyContent: "space-between"}}>
          <div>
            <p style={{fontSize: 20, color: C.faint, letterSpacing: ".14em"}}>THE SYSTEM BEHIND KRYX</p>
            <h2 style={{...display, fontSize: 78, marginTop: 18}}>Specialists stay backstage.</h2>
          </div>
          <p style={{fontSize: 24, color: C.muted, maxWidth: 520, textAlign: "right", lineHeight: 1.45}}>
            You see the task, the evidence, the draft and the decision.
          </p>
        </div>
        <div style={{marginTop: 70, borderTop: "1px solid " + C.line}}>
          {lanes.map((lane, i) => {
            const p = spring({frame: f - 45 - i * 35, fps: 60, config: {damping: 18, stiffness: 110}});
            return (
              <div
                key={lane[0]}
                style={{
                  display: "grid",
                  gridTemplateColumns: "280px 1fr 250px",
                  alignItems: "center",
                  padding: "34px 0",
                  borderBottom: "1px solid " + C.line,
                  opacity: p,
                  transform: "translateY(" + (1 - p) * 24 + "px)",
                }}
              >
                <div style={{fontSize: 16, color: C.accent, fontWeight: 800, letterSpacing: ".08em"}}>{lane[0]}</div>
                <div style={{fontSize: 28, fontWeight: 700}}>{lane[1]}</div>
                <div style={{textAlign: "right", fontSize: 18, color: C.muted}}>{lane[2]}</div>
              </div>
            );
          })}
          <div style={{display: "grid", gridTemplateColumns: "280px 1fr 250px", alignItems: "center", padding: "34px 0", borderBottom: "1px solid " + C.line}}>
            <div style={{fontSize: 16, color: C.green, fontWeight: 800, letterSpacing: ".08em"}}>APPROVAL</div>
            <div style={{fontSize: 28, fontWeight: 700}}>public · outbound · irreversible</div>
            <div style={{textAlign: "right", fontSize: 18, color: C.green}}>waits for you ✓</div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Closing = () => {
  const f = useCurrentFrame();
  const p = spring({frame: f, fps: 60, config: {damping: 18, stiffness: 105}});
  return (
    <AbsoluteFill style={{background: C.bg, color: C.fg, ...body}}>
      <Grid />
      <div style={{position: "absolute", inset: 0, display: "grid", placeItems: "center"}}>
        <div style={{textAlign: "center", opacity: p, transform: "translateY(" + (1 - p) * 35 + "px)"}}>
          <div style={{display: "flex", justifyContent: "center", marginBottom: 36}}><BrandMark size={82} /></div>
          <h2 style={{...display, fontSize: 92, lineHeight: 0.97, margin: 0}}>Give Kryx the goal.</h2>
          <h2 style={{...display, fontSize: 92, lineHeight: 0.97, margin: "8px 0 0", color: C.accent}}>Come back to finished work.</h2>
          <p style={{fontSize: 30, color: C.muted, marginTop: 36}}>KryxAI · getkryxai.com</p>
          <div style={{marginTop: 34, display: "inline-block", background: C.fg, color: C.bg, padding: "18px 28px", fontWeight: 800, fontSize: 20, borderRadius: 10}}>
            Start with 100 credits →
          </div>
        </div>
      </div>
      <Sequence from={18} durationInFrames={10}><Audio src={SFX.success} volume={0.22} /></Sequence>
    </AbsoluteFill>
  );
};

export const KryxLaunch: React.FC = () => (
  <AbsoluteFill style={{background: C.bg}}>
    <Sequence from={0} durationInFrames={210}><Intro /></Sequence>
    <Sequence from={180} durationInFrames={520}><Problem /></Sequence>
    <Sequence from={650} durationInFrames={380}><Thesis /></Sequence>
    <Sequence from={980} durationInFrames={620}><MissionControl /></Sequence>
    <Sequence from={1540} durationInFrames={520}><EvidenceRoom /></Sequence>
    <Sequence from={2000} durationInFrames={520}><Army /></Sequence>
    <Sequence from={2470} durationInFrames={1130}><Closing /></Sequence>
  </AbsoluteFill>
);
