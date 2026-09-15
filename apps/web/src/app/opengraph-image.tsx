import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "KryxAI — One goal. Eight agents. Marketing work comes back done.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  const people = [
    ["/brand/kryx/agents/kryx.webp", "Kryx"],
    ["/brand/kryx/agents/ida.webp", "Ida"],
    ["/brand/kryx/agents/vera.webp", "Vera"],
    ["/brand/kryx/agents/rook.webp", "Rook"],
    ["/brand/kryx/agents/dex.webp", "Dex"],
  ];

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#f8f8f3",
        color: "#0b0d09",
        padding: "48px 70px",
        fontFamily: "Arial, sans-serif",
        textAlign: "center",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          fontSize: 24,
          fontWeight: 800,
          letterSpacing: "-1px",
        }}
      >
        <span
          style={{
            width: 16,
            height: 16,
            borderRadius: 5,
            background: "#e6ff3f",
            border: "1px solid #b9d31f",
          }}
        />
        KryxAI
      </div>

      <div
        style={{
          marginTop: 42,
          maxWidth: 980,
          fontSize: 82,
          lineHeight: 0.93,
          letterSpacing: "-5px",
          fontWeight: 800,
        }}
      >
        One goal. Eight agents.
        <br />
        <span style={{ color: "#627400" }}>Work comes back done.</span>
      </div>

      <div
        style={{
          marginTop: 22,
          maxWidth: 790,
          fontSize: 21,
          lineHeight: 1.45,
          color: "#62695b",
        }}
      >
        Research, SEO, content, leads and outreach — routed to named specialists
        with evidence attached and one approval queue.
      </div>

      <div style={{ marginTop: 34, display: "flex", alignItems: "center", gap: 12 }}>
        {people.map(([src, name], index) => (
          <div
            key={name}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 12px 8px 8px",
              background: "#ffffff",
              border: "1px solid #dfe2d8",
              borderRadius: 16,
            }}
          >
            <img
              src={src}
              width="48"
              height="48"
              style={{ borderRadius: 13, objectFit: "cover" }}
            />
            <span style={{ fontSize: 14, fontWeight: 800 }}>{name}</span>
            {index === 0 ? (
              <span
                style={{
                  marginLeft: 2,
                  width: 7,
                  height: 7,
                  borderRadius: 99,
                  background: "#e6ff3f",
                }}
              />
            ) : null}
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: 26,
          display: "flex",
          gap: 16,
          fontSize: 14,
          fontWeight: 700,
          color: "#70776a",
        }}
      >
        <span>100 starter credits</span>
        <span>·</span>
        <span>No card</span>
        <span>·</span>
        <span>Top up from $5</span>
      </div>
    </div>,
    size,
  );
}
