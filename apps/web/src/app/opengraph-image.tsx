import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "KryxAI — wake up to finished marketing work";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

function Mark() {
  return <svg width="58" height="58" viewBox="0 0 40 40" fill="none"><rect width="40" height="40" rx="8" fill="#15120f"/><path d="M8.5 20h9.2M22.3 16.6l7.8-7.8M22.5 20h9M22.3 23.4l7.8 7.8" stroke="#fbf9f5" strokeWidth="3.1" strokeLinecap="round"/><path d="m20 14.9 5.1 5.1-5.1 5.1-5.1-5.1 5.1-5.1Z" fill="#fbf9f5"/><circle cx="7.7" cy="20" r="2.5" fill="#fbf9f5"/><rect x="28.6" y="6.8" width="5" height="5" rx="1.2" fill="#fbf9f5"/><circle cx="31.5" cy="20" r="2.5" fill="#fbf9f5"/><rect x="28.6" y="28.2" width="5" height="5" rx="1.2" fill="#fbf9f5"/></svg>;
}

export default function OpenGraphImage() {
  const rows = [["06:52", "Competitor change found", "evidence saved"], ["07:01", "Homepage rewrite ready", "needs approval"], ["07:04", "18 prospects qualified", "list ready"]];
  return new ImageResponse(
    <div style={{ width:"100%", height:"100%", display:"flex", background:"#f7f7f4", color:"#0a0a0c", padding:"56px 64px", fontFamily:"Arial, sans-serif", borderTop:"12px solid #315efb" }}>
      <div style={{ display:"flex", width:"51%", flexDirection:"column" }}>
        <div style={{ display:"flex", alignItems:"center", gap:14 }}><Mark/><span style={{ fontSize:30, fontWeight:800, letterSpacing:"-1px" }}>KryxAI</span></div>
        <div style={{ marginTop:78, fontSize:74, lineHeight:.93, letterSpacing:"-4px", fontWeight:800 }}>Wake up to<br/><span style={{ color:"#315efb" }}>finished marketing work.</span></div>
        <div style={{ marginTop:"auto", display:"flex", gap:22, fontSize:16, color:"#625b52" }}><span>100 credits included</span><span>·</span><span>No subscription</span></div>
      </div>
      <div style={{ width:"49%", display:"flex", alignItems:"center", paddingLeft:42 }}>
        <div style={{ width:"100%", border:"1px solid #bdb4a4", background:"#fff", display:"flex", flexDirection:"column" }}>
          <div style={{ display:"flex", justifyContent:"space-between", borderBottom:"1px solid #ded7ca", padding:"18px 20px" }}><b>Morning brief</b><span style={{ color:"#315efb", fontWeight:700 }}>3 ready</span></div>
          {rows.map(([time,title,status])=><div key={time} style={{ display:"flex", borderBottom:"1px solid #ded7ca", padding:"20px", gap:18 }}><span style={{ color:"#8a8177", fontSize:13 }}>{time}</span><div style={{ display:"flex", flexDirection:"column" }}><b style={{ fontSize:18 }}>{title}</b><span style={{ color:"#6d655c", fontSize:13, marginTop:7 }}>✓ {status}</span></div></div>)}
          <div style={{ display:"flex", justifyContent:"space-between", padding:"17px 20px", background:"#15120f", color:"#fff" }}><span>2 decisions need you</span><b>Review work →</b></div>
        </div>
      </div>
    </div>, size,
  );
}
