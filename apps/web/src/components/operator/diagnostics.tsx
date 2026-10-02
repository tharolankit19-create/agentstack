"use client";
import { useState } from "react";
export function Diagnostics() {
  const [result, setResult] = useState<Record<string, unknown> | null>(null),
    [error, setError] = useState("");
  return (
    <section className="op">
      <h2>Kryx → Diagnose</h2>
      <p className="op-sub">
        Check database access, execution configuration and your task queue.
      </p>
      <button
        onClick={async () => {
          try {
            const r = await fetch("/api/kryx/diagnose", { method: "POST" }),
              d = await r.json();
            if (!r.ok) throw new Error(d.error);
            setResult(d);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Diagnostic failed");
          }
        }}
      >
        Run system test
      </button>
      {error && <p role="alert">{error}</p>}
      {result && (
        <dl className="op-section">
          {Object.entries(result).map(([key, value]) => (
            <div className="op-task" key={key}>
              <dt>{key}</dt>
              <dd>
                {typeof value === "boolean"
                  ? value
                    ? "Available / configured"
                    : "Unavailable"
                  : String(value)}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
