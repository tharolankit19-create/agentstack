import { ImageResponse } from "next/og";
import { SITE } from "@/lib/site";
import { REPLACEABLES, getReplaceable, VERDICT_COPY } from "@/lib/replaceability";

/**
 * A share card per tool.
 *
 * These pages get posted into places where the image is the whole post, so the
 * verdict has to be readable at thumbnail size. The "keep paying for it" cards
 * are the ones most likely to travel — a company telling you not to buy from
 * them is a screenshot.
 */

export const alt = "Can an agent replace this tool?";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Literal here and nowhere else: satori resolves no cascade, and a share
// card has no theme to follow — it is a PNG.
const INK = "#07080b";
const PAPER = "#ffffff";
const ACCENT = "#8b7cff";
const MUTED = "#8b93a5";
const LIVE = "#35d6f2";
const MONEY = "#ffc247";

export function generateStaticParams() {
  return REPLACEABLES.map((entry) => ({ tool: entry.slug }));
}

export default async function Image({
  params,
}: {
  params: Promise<{ tool: string }>;
}) {
  const { tool } = await params;
  const entry = getReplaceable(tool);

  const verdict = entry?.verdict ?? "yes";
  const accent =
    verdict === "yes" ? LIVE : verdict === "partial" ? MONEY : MUTED;

  const headline = !entry
    ? SITE.name
    : verdict === "no"
      ? `Keep paying for ${entry.tool}.`
      : verdict === "partial"
        ? `${entry.tool}: half of it.`
        : `Replace ${entry.tool}.`;

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
          <div style={{ fontSize: 28, fontWeight: 800, color: PAPER }}>
            {SITE.name}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              alignSelf: "flex-start",
              background: accent,
              color: INK,
              fontSize: 26,
              fontWeight: 800,
              padding: "8px 20px",
              borderRadius: 999,
              marginBottom: 28,
            }}
          >
            {VERDICT_COPY[verdict].label}
          </div>

          <div
            style={{
              fontSize: headline.length > 26 ? 74 : 90,
              fontWeight: 800,
              color: PAPER,
              lineHeight: 1.03,
              letterSpacing: -3,
            }}
          >
            {headline}
          </div>
        </div>

        <div style={{ fontSize: 28, color: MUTED, fontWeight: 500 }}>
          {entry
            ? `${entry.job} · agentstack /replace`
            : "An honest list of what agents can and cannot replace"}
        </div>
      </div>
    ),
    size,
  );
}
