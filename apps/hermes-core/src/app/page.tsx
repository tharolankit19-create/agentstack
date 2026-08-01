export const dynamic = "force-dynamic";

/**
 * A deployed agent has no UI. This page exists so that a founder who opens
 * their agent's URL sees something honest instead of a 404.
 */
export default function Page() {
  const templateId = process.env.ACTIVE_TEMPLATE ?? "unconfigured";

  return (
    <main
      style={{
        maxWidth: 560,
        margin: "0 auto",
        padding: "96px 24px",
        lineHeight: 1.6,
      }}
    >
      <p
        style={{
          display: "inline-block",
          padding: "4px 10px",
          borderRadius: 999,
          background: "#8b5cf6",
          color: "#fff",
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: 0.4,
          textTransform: "uppercase",
        }}
      >
        AgentStack
      </p>

      <h1 style={{ fontSize: 32, margin: "20px 0 8px", letterSpacing: -0.5 }}>
        This agent is running.
      </h1>
      <p style={{ color: "#a1a1aa", margin: 0 }}>
        Template: <code style={{ color: "#fafafa" }}>{templateId}</code>
      </p>

      <p style={{ color: "#a1a1aa", marginTop: 32 }}>
        There is nothing to click here. Talk to this agent from your AgentStack
        dashboard — it runs on its schedule on its own.
      </p>

      <ul style={{ color: "#71717a", fontSize: 14, paddingLeft: 18 }}>
        <li>
          <code>GET /api/health</code> — status, no auth
        </li>
        <li>
          <code>POST /api/run</code> — one task, bearer token
        </li>
        <li>
          <code>POST /api/chat</code> — conversation, bearer token
        </li>
        <li>
          <code>GET /api/schedule</code> — cron tick
        </li>
      </ul>
    </main>
  );
}
