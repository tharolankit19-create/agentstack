import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "KryxAI — 1 goal. 8 agents. Work comes back done.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  const people = [
    ["/brand/kryx/agents/kryx.webp", "Kryx", "Head"],
    ["/brand/kryx/agents/ida.webp", "Ida", "Research"],
    ["/brand/kryx/agents/rook.webp", "Rook", "Leads"],
    ["/brand/kryx/agents/dex.webp", "Dex", "Outreach"],
  ];

  return new ImageResponse(
    <div style={{ width:"100%", height:"100%", display:"flex", background:"#f8f7f2", color:"#0a0a0a", padding:"52px 58px", fontFamily:"Arial, sans-serif" }}>
      <div style={{ width:"61%", display:"flex", flexDirection:"column" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, fontSize:28, fontWeight:800, letterSpacing:"-1px" }}><span style={{ width:16, height:16, borderRadius:5, background:"#c6ff4a", border:"1px solid #9fcf2e" }} />KryxAI</div>
        <div style={{ marginTop:70, fontSize:76, lineHeight:.92, letterSpacing:"-5px", fontWeight:800 }}>
          1 goal. 8 agents.<br/>
          <span style={{ color:"#617d00" }}>Work comes back done.</span>
        </div>
        <div style={{ marginTop:24, fontSize:20, lineHeight:1.45, color:"#60646c", maxWidth:610 }}>
          Research, SEO, content and pipeline move in parallel — with evidence and one approval queue.
        </div>
        <div style={{ marginTop:"auto", display:"flex", gap:18, fontSize:15, fontWeight:700, color:"#60646c" }}>
          <span>100 starter credits</span><span>·</span><span>$0/month</span><span>·</span><span>Top up from $5</span>
        </div>
      </div>

      <div style={{ width:"39%", display:"flex", alignItems:"center", justifyContent:"center" }}>
        <div style={{ width:"100%", display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
          {people.map(([src,name,role]) => (
            <div key={name} style={{ display:"flex", flexDirection:"column", alignItems:"center", background:"#fff", border:"1px solid #dcdfe6", borderRadius:20, padding:"18px 12px" }}>
              <img src={src} width="92" height="92" style={{ borderRadius:24, objectFit:"cover" }} />
              <b style={{ marginTop:10, fontSize:16 }}>{name}</b>
              <span style={{ marginTop:3, fontSize:11, color:"#70757f" }}>{role}</span>
            </div>
          ))}
        </div>
      </div>
    </div>,
    size,
  );
}
