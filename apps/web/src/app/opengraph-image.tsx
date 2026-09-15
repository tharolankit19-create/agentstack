import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "KryxAI — stop managing AI. Give Kryx the goal.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ width:"100%", height:"100%", display:"flex", background:"#f7f8fb", color:"#090b10", padding:"52px 58px", fontFamily:"Arial, sans-serif" }}>
      <div style={{ width:"57%", display:"flex", flexDirection:"column" }}>
        <div style={{ fontSize:28, fontWeight:800, letterSpacing:"-1px" }}>KryxAI</div>
        <div style={{ marginTop:74, fontSize:76, lineHeight:.92, letterSpacing:"-5px", fontWeight:800 }}>
          Stop managing AI.<br/>
          <span style={{ color:"#4d63ff" }}>Give Kryx the goal.</span>
        </div>
        <div style={{ marginTop:24, fontSize:20, lineHeight:1.45, color:"#5e6674", maxWidth:590 }}>
          8 agents coordinate research, SEO, content, conversion and pipeline work. You approve the consequence.
        </div>
        <div style={{ marginTop:"auto", display:"flex", gap:18, fontSize:15, fontWeight:700, color:"#5e6674" }}>
          <span>8 agents</span><span>·</span><span>100 starter credits</span><span>·</span><span>$0/month</span>
        </div>
      </div>

      <div style={{ width:"43%", display:"flex", alignItems:"center", paddingLeft:36 }}>
        <div style={{ width:"100%", border:"1px solid #d5d9e2", borderRadius:22, background:"#fff", overflow:"hidden", display:"flex", flexDirection:"column", boxShadow:"0 24px 70px rgba(20,25,40,.08)" }}>
          <div style={{ padding:"18px 20px", borderBottom:"1px solid #e7e9ef", display:"flex", flexDirection:"column" }}>
            <span style={{ color:"#8b93a1", fontSize:12, fontWeight:700, letterSpacing:"1px" }}>MISSION</span>
            <b style={{ marginTop:6, fontSize:18 }}>Find 20 SaaS founders worth talking to this week.</b>
          </div>
          {[
            ["Ida","Market research","8 sources checked"],
            ["Rook","Lead research","12 qualified"],
            ["Dex","Outreach","12 drafts waiting"],
          ].map(([name,role,result]) => (
            <div key={name} style={{ padding:"16px 20px", borderBottom:"1px solid #e7e9ef", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div style={{ display:"flex", flexDirection:"column" }}><b style={{ fontSize:16 }}>{name}</b><span style={{ fontSize:12, color:"#5e6674", marginTop:3 }}>{role}</span></div>
              <span style={{ fontSize:12, color:"#4d63ff", fontWeight:700 }}>✓ {result}</span>
            </div>
          ))}
          <div style={{ padding:"16px 20px", background:"#090b10", color:"#fff", display:"flex", justifyContent:"space-between", fontSize:14 }}>
            <span>Evidence saved</span><b>Review work →</b>
          </div>
        </div>
      </div>
    </div>,
    size,
  );
}
