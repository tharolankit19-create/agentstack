import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "KryxAI — give Kryx the goal, get the work back";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  const rows = [
    ["Ida", "Competitor move found", "evidence saved"],
    ["Wren", "Search gap isolated", "fix ready"],
    ["Rook", "5 qualified founders", "list ready"],
  ];

  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", background: "#f7f8fb", color: "#090b10", padding: "56px 62px", fontFamily: "Arial, sans-serif" }}>
      <div style={{ display: "flex", width: "54%", flexDirection: "column" }}>
        <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-1px" }}>KryxAI</div>
        <div style={{ marginTop: 92, fontSize: 72, lineHeight: .94, letterSpacing: "-4px", fontWeight: 800 }}>
          Give Kryx the goal.<br />
          <span style={{ color: "#4d63ff" }}>Get the work back.</span>
        </div>
        <div style={{ marginTop: "auto", display: "flex", gap: 22, fontSize: 17, color: "#5e6674" }}>
          <span>8 agents</span><span>·</span><span>100 free credits</span><span>·</span><span>$0/month</span>
        </div>
      </div>

      <div style={{ width: "46%", display: "flex", alignItems: "center", paddingLeft: 36 }}>
        <div style={{ width: "100%", border: "1px solid rgba(18,22,31,.14)", borderRadius: 22, background: "#fff", overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #e5e8ef", padding: "18px 20px" }}>
            <b>Kryx is working</b><span style={{ color: "#11956f", fontWeight: 700 }}>3 ready</span>
          </div>
          {rows.map(([agent, title, status]) => (
            <div key={agent} style={{ display: "flex", borderBottom: "1px solid #e5e8ef", padding: "18px 20px", gap: 14, alignItems: "center" }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "#11151c", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800 }}>{agent[0]}</div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <b style={{ fontSize: 17 }}>{title}</b>
                <span style={{ color: "#5e6674", fontSize: 12, marginTop: 5 }}>{agent} · {status}</span>
              </div>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "16px 20px", background: "#090b10", color: "#fff" }}>
            <span>2 decisions need you</span><b>Review work →</b>
          </div>
        </div>
      </div>
    </div>,
    size,
  );
}
