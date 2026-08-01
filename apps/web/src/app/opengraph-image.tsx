import { ImageResponse } from "next/og";

/**
 * The OG image is a thumbnail, not a business card.
 *
 * It is seen far more often than the site itself — in a timeline, at thumbnail
 * size, next to a hundred other links. So: one claim, enormous type, one
 * violet word. If it does not read at 400px wide, it does not work.
 */

export const alt = "Your marketing team costs $2,000 a month. AgentStack costs $29.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#ffffff",
          padding: 72,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: "#8b5cf6",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontSize: 26,
              fontWeight: 800,
            }}
          >
            A
          </div>
          <div style={{ fontSize: 30, fontWeight: 800, color: "#0a0a0a" }}>
            AgentStack
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 82,
              fontWeight: 800,
              color: "#0a0a0a",
              lineHeight: 1.03,
              letterSpacing: -3,
            }}
          >
            Your marketing team
          </div>
          <div
            style={{
              fontSize: 82,
              fontWeight: 800,
              color: "#0a0a0a",
              lineHeight: 1.03,
              letterSpacing: -3,
            }}
          >
            costs $2,000 a month.
          </div>
          <div
            style={{
              fontSize: 82,
              fontWeight: 800,
              color: "#8b5cf6",
              lineHeight: 1.03,
              letterSpacing: -3,
              marginTop: 10,
            }}
          >
            Mine costs $29. Once.
          </div>
        </div>

        <div style={{ fontSize: 30, color: "#52525b", fontWeight: 500 }}>
          3 AI agents · live on your own URL in 90 seconds · no subscription
        </div>
      </div>
    ),
    size,
  );
}
