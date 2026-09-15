import { ImageResponse } from "next/og";
import { SITE } from "@/lib/site";

export const runtime = "edge";
export const alt = "KryxAI — Your AI Head of Marketing";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

function BrandMark({ small = false }: { small?: boolean }) {
  const side = small ? 28 : 62;
  return (
    <img
      src={`${SITE.url}/brand/kryx/kryx-mark.webp`}
      width={side}
      height={side}
      alt=""
      style={{ borderRadius: small ? 8 : 17, objectFit: "cover" }}
    />
  );
}

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", overflow: "hidden", background: "#08090d", color: "white", fontFamily: "Arial, Helvetica, sans-serif" }}>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 84% 15%, rgba(92,105,255,.38), transparent 33%), radial-gradient(circle at 68% 88%, rgba(45,211,164,.22), transparent 30%), linear-gradient(135deg,#08090d 0%,#10131d 58%,#11121b 100%)" }} />
      <div style={{ position: "absolute", right: -80, bottom: -170, width: 660, height: 660, borderRadius: 999, border: "1px solid rgba(255,255,255,.12)", boxShadow: "0 0 120px rgba(88,105,255,.25)" }} />

      <div style={{ width: "100%", display: "flex", padding: "58px 66px", position: "relative", zIndex: 2 }}>
        <div style={{ width: "52%", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <BrandMark />
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-1px" }}>KryxAI</div>
              <div style={{ fontSize: 12, letterSpacing: "3px", color: "#9ba1b3" }}>AI MARKETING TEAM FOR FOUNDERS</div>
            </div>
          </div>

          <div style={{ marginTop: 72, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", width: "fit-content", padding: "9px 14px", borderRadius: 999, border: "1px solid rgba(255,255,255,.13)", background: "rgba(255,255,255,.06)", fontSize: 14, fontWeight: 700, color: "#d7d9e2" }}>● &nbsp; RESEARCH · SEO · CONTENT · PIPELINE</div>
            <div style={{ marginTop: 22, fontSize: 72, lineHeight: .92, letterSpacing: "-4px", fontWeight: 900 }}>Your AI Head<br />of Marketing.</div>
            <div style={{ marginTop: 24, fontSize: 21, lineHeight: 1.42, color: "#b5b8c4", maxWidth: 520 }}>Research, SEO, content and pipeline work coordinated in one command center — with consequential actions kept behind your approval.</div>
          </div>

          <div style={{ marginTop: "auto", display: "flex", gap: 24, fontSize: 16, color: "#dfe1e8" }}>
            <div>$0/month</div><div style={{ color: "#686e7f" }}>•</div><div>100 free credits</div><div style={{ color: "#686e7f" }}>•</div><div>No seat fee</div>
          </div>
        </div>

        <div style={{ width: "48%", display: "flex", alignItems: "center", justifyContent: "center", paddingLeft: 34 }}>
          <div style={{ width: 510, height: 430, borderRadius: 34, padding: 14, background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.16)", boxShadow: "0 50px 110px rgba(0,0,0,.5)", transform: "rotate(-2deg)" }}>
            <div style={{ width: "100%", height: "100%", borderRadius: 24, background: "#f8f9fc", color: "#111318", display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <div style={{ height: 62, borderBottom: "1px solid #e8eaf0", display: "flex", alignItems: "center", padding: "0 22px", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 18, fontWeight: 800 }}><BrandMark small />Kryx</div>
                <div style={{ padding: "8px 12px", borderRadius: 10, background: "#111318", color: "white", fontSize: 12, fontWeight: 700 }}>Working</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", padding: 22 }}>
                <div style={{ fontSize: 14, color: "#73798a", fontWeight: 700, letterSpacing: "1.8px" }}>TODAY</div>
                <div style={{ marginTop: 8, fontSize: 25, fontWeight: 900, letterSpacing: "-1px" }}>4 specialist jobs moved forward</div>
                <div style={{ marginTop: 18, display: "flex", gap: 10 }}>
                  {[["Research","#8b7dff"],["SEO","#43d39e"],["Content","#ffb15f"],["Leads","#6d8cff"]].map(([label,color]) => (
                    <div key={label} style={{ flex: 1, minWidth: 0, height: 104, borderRadius: 18, background: "white", border: "1px solid #e6e8ee", padding: 14, display: "flex", flexDirection: "column" }}>
                      <div style={{ width: 30, height: 30, borderRadius: 10, background: `${color}18`, color, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900 }}>•</div>
                      <div style={{ marginTop: 10, fontSize: 13, fontWeight: 800 }}>{label}</div>
                      <div style={{ marginTop: 3, fontSize: 11, color: "#8b91a0" }}>done</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 16, borderRadius: 18, padding: 18, background: "#111318", color: "white", display: "flex", flexDirection: "column" }}>
                  <div style={{ fontSize: 12, color: "#979dab", letterSpacing: "1.2px", fontWeight: 700 }}>FOUNDER REVIEW</div>
                  <div style={{ marginTop: 8, fontSize: 19, fontWeight: 800 }}>Three actions need your review.</div>
                  <div style={{ marginTop: 5, fontSize: 12, color: "#aeb3bf" }}>Nothing publishes without you.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    size,
  );
}
