"use client";

/**
 * The last resort.
 *
 * Replaces the root layout, so it ships its own <html> and inline styles —
 * anything that depends on the app's CSS may be exactly what failed.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          background: "#ffffff",
          color: "#0a0a0a",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          padding: 24,
        }}
      >
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>
            AgentStack hit an error.
          </h1>
          <p style={{ color: "#52525b", lineHeight: 1.6, marginTop: 12 }}>
            {error.message || "Something went wrong loading the app."}
          </p>
          {error.digest ? (
            <p style={{ color: "#a1a1aa", fontSize: 12, marginTop: 8 }}>
              Reference: {error.digest}
            </p>
          ) : null}
          <button
            onClick={reset}
            style={{
              marginTop: 24,
              background: "#8b5cf6",
              color: "#fff",
              border: 0,
              borderRadius: 10,
              padding: "12px 22px",
              fontSize: 15,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
