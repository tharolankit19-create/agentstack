import { ImageResponse } from "next/og";
import { TEMPLATES, TOTAL_MONTHLY_REPLACED } from "@/lib/templates";

/**
 * The OG image is a thumbnail, not a business card.
 *
 * It is seen far more often than the site itself — in a timeline, at thumbnail
 * size, next to a hundred other links. So: one claim, enormous type, one
 * violet word. If it does not read at 400px wide, it does not work.
 */

export const alt = "Cancel your SaaS. Keep the work.";
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
              fontSize: 96,
              fontWeight: 800,
              color: "#0a0a0a",
              lineHeight: 1.02,
              letterSpacing: -4,
            }}
          >
            Cancel your SaaS.
          </div>
          <div
            style={{
              fontSize: 96,
              fontWeight: 800,
              color: "#8b5cf6",
              lineHeight: 1.02,
              letterSpacing: -4,
            }}
          >
            Keep the work.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "baseline", gap: 18 }}>
          <div
            style={{
              fontSize: 36,
              color: "#a1a1aa",
              fontWeight: 700,
              textDecoration: "line-through",
            }}
          >
            {`$${TOTAL_MONTHLY_REPLACED.toLocaleString("en-US")}/mo`}
          </div>
          <div style={{ fontSize: 36, color: "#52525b" }}>→</div>
          <div style={{ fontSize: 44, color: "#0a0a0a", fontWeight: 800 }}>
            {"$29/mo"}
          </div>
          <div style={{ fontSize: 28, color: "#52525b", marginLeft: 12 }}>
            {`${TEMPLATES.length} agents · live in 90 seconds`}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
