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
const INK = "#15120f";
const PAPER = "#f4f0e8";
const MUTED = "#6d655c";
const LIVE = "#06914a";
const MONEY = "#9a6200";

function Mark() {
  return (
    <svg width="42" height="42" viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="8" fill={PAPER} />
      <path d="M8.5 20h9.2M22.3 16.6l7.8-7.8M22.5 20h9M22.3 23.4l7.8 7.8" stroke={INK} strokeWidth="3.1" strokeLinecap="round" />
      <path d="m20 14.9 5.1 5.1-5.1 5.1-5.1-5.1 5.1-5.1Z" fill={INK} />
      <circle cx="7.7" cy="20" r="2.5" fill={INK} />
      <rect x="28.6" y="6.8" width="5" height="5" rx="1.2" fill={INK} />
      <circle cx="31.5" cy="20" r="2.5" fill={INK} />
      <rect x="28.6" y="28.2" width="5" height="5" rx="1.2" fill={INK} />
    </svg>
  );
}

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
          <Mark />
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
