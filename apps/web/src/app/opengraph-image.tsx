import { ImageResponse } from "next/og";
import { SITE } from "@/lib/site";
import { TEMPLATES, TOTAL_MONTHLY_REPLACED } from "@/lib/templates";

/**
 * The OG image is a thumbnail, not a business card.
 *
 * It is seen far more often than the site itself — in a timeline, at thumbnail
 * size, next to a hundred other links. So: one claim, enormous type, one
 * accent word. If it does not read at 400px wide, it does not work.
 *
 * Colours are literal here and nowhere else. Satori resolves no cascade, so a
 * custom property would render as nothing; and a card that follows the reader's
 * theme is not a thing that exists — it is a PNG.
 */

export const alt = "Cancel your SaaS. Keep the work.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#07080b";
const PAPER = "#ffffff";
const ACCENT = "#8b7cff";
const MUTED = "#8b93a5";
const MONEY = "#ffc247";
const DANGER = "#ff5f57";

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
          background: INK,
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
              background: ACCENT,
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
          <div style={{ fontSize: 30, fontWeight: 800, color: PAPER }}>
            {SITE.name}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 96,
              fontWeight: 800,
              color: PAPER,
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
              color: ACCENT,
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
              color: DANGER,
              fontWeight: 700,
              textDecoration: "line-through",
            }}
          >
            {`$${TOTAL_MONTHLY_REPLACED.toLocaleString("en-US")}/mo`}
          </div>
          <div style={{ fontSize: 36, color: MUTED }}>→</div>
          <div style={{ fontSize: 44, color: MONEY, fontWeight: 800 }}>
            {"$29/mo"}
          </div>
          <div style={{ fontSize: 28, color: MUTED, marginLeft: 12 }}>
            {`${TEMPLATES.length} agents · live in 90 seconds`}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
