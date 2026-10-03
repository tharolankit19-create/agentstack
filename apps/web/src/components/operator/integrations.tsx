"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AdapterManifest } from "@/lib/operator/adapters";

type Connector = {
  id: string;
  name: string;
  connected: boolean;
  provided?: boolean;
  hint?: string | null;
  blurb: string;
  getUrl: string;
  unlocks: string;
  placeholder: string;
};
type Adapter = {
  id: string;
  goal_id: string;
  manifest: AdapterManifest;
  manifest_hash: string;
  state: string;
  connected: boolean;
};
async function api(path: string, method = "GET", body?: unknown) {
  const r = await fetch(path, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "Connection request failed");
  return data;
}
function CredentialForm({
  name,
  onSave,
}: {
  name: string;
  onSave: (key: string) => Promise<void>;
}) {
  const [key, setKey] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <form
      className="op-fields"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          await onSave(key);
          setKey("");
        } catch (e) {
          setError(e instanceof Error ? e.message : "Could not save");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        {name} credential
        <input
          aria-label={name + " credential"}
          type="password"
          autoComplete="off"
          value={key}
          onChange={(e) => setKey(e.target.value)}
        />
      </label>
      <button disabled={busy || key.trim().length < 3}>
        {busy ? "Saving…" : "Save encrypted credential"}
      </button>
      {error && (
        <p role="alert" className="op-error">
          {error}
        </p>
      )}
    </form>
  );
}
export function Integrations() {
  const router = useRouter(),
    [connectors, setConnectors] = useState<Connector[]>([]),
    [adapters, setAdapters] = useState<Adapter[]>([]);
  const [url, setUrl] = useState(""),
    [purpose, setPurpose] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const request = useRef<{ snapshot: string; key: string } | null>(null);
  const refresh = useCallback(async () => {
    try {
      const [native, custom] = await Promise.all([
        api("/api/connectors"),
        api("/api/kryx/adapters"),
      ]);
      setConnectors(native.connectors);
      setAdapters(custom.adapters);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load integrations");
    }
  }, []);
  useEffect(() => {
    void refresh();
    const timer = setInterval(refresh, 5000);
    return () => clearInterval(timer);
  }, [refresh]);
  return (
    <section className="op">
      <div className="op-heading">
        <span>Kryx / Integrations</span>
        <Link href="/dashboard/tasks">Tasks ↗</Link>
      </div>
      <h1>Give Kryx access to your tools.</h1>
      <p className="op-sub">
        Connect once. Kryx uses available APIs before its browser. Keys stay
        encrypted on the server.
      </p>
      {error && (
        <p role="alert" className="op-error">
          {error}
        </p>
      )}
      <div className="op-section">
        <h2>Connected services</h2>
        {connectors.map((c) => (
          <details className="op-row op-connection" key={c.id}>
            <summary>
              <strong>{c.name}</strong>
              <span>
                {c.connected
                  ? "Your key connected"
                  : c.provided
                    ? "Platform configured"
                    : "Connect"}
              </span>
            </summary>
            <p className="op-sub">{c.unlocks}</p>
            <a href={c.getUrl} target="_blank" rel="noreferrer">
              Get your credential ↗
            </a>
            <CredentialForm
              name={c.name}
              onSave={async (key) => {
                await api("/api/connectors", "POST", { id: c.id, key });
                await refresh();
              }}
            />
            {c.connected && (
              <button
                onClick={async () => {
                  try {
                    await api("/api/connectors", "DELETE", { id: c.id });
                    await refresh();
                  } catch (e) {
                    setError(
                      e instanceof Error ? e.message : "Could not disconnect",
                    );
                  }
                }}
              >
                Disconnect your key
              </button>
            )}
          </details>
        ))}
      </div>
      <div className="op-section">
        <h2>Connect a tool from its docs</h2>
        <p className="op-sub">
          Kryx reads the documentation and proposes an adapter. Review its
          endpoints, run a credential-free test, then approve installation.
          Generated writes remain blocked.
        </p>
        <form
          className="op-fields"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              const snapshot = JSON.stringify({ url, purpose });
              if (request.current?.snapshot !== snapshot)
                request.current = { snapshot, key: crypto.randomUUID() };
              const r = await api("/api/kryx/adapters", "POST", {
                documentation_url: url,
                purpose,
                idempotency_key: request.current.key,
              });
              router.push("/dashboard/tasks/" + r.id);
            } catch (e) {
              setError(
                e instanceof Error
                  ? e.message
                  : "Could not create discovery task",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Documentation or API URL
            <input
              type="url"
              required
              value={url}
              placeholder="https://service.com/docs/api"
              onChange={(e) => setUrl(e.target.value)}
            />
          </label>
          <label>
            What should Kryx read?
            <input
              required
              minLength={8}
              value={purpose}
              placeholder="Read my weekly conversion analytics"
              onChange={(e) => setPurpose(e.target.value)}
            />
          </label>
          <button disabled={busy || purpose.trim().length < 8 || !url}>
            {busy ? "Creating task…" : "Read docs and propose adapter"}
          </button>
        </form>
      </div>
      <div className="op-section">
        <h2>Your API adapters</h2>
        {!adapters.length && (
          <p className="op-empty">
            Your proposed and installed adapters will appear here.
          </p>
        )}
        {adapters.map((a) => (
          <AdapterCard key={a.id} adapter={a} refresh={refresh} />
        ))}
      </div>
    </section>
  );
}
function AdapterCard({
  adapter: a,
  refresh,
}: {
  adapter: Adapter;
  refresh: () => Promise<void>;
}) {
  const router = useRouter(),
    [examples, setExamples] = useState("{}"),
    [parameters, setParameters] = useState("{}"),
    [action, setAction] = useState(a.manifest.actions[0]?.name || "");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const pending = useRef<{ snapshot: string; key: string } | null>(null);
  async function mutate(
    operation: string,
    body: Record<string, unknown>,
    goal = false,
  ) {
    setBusy(true);
    setError("");
    try {
      if (goal) {
        const snapshot = JSON.stringify({ operation, body });
        if (pending.current?.snapshot !== snapshot)
          pending.current = { snapshot, key: crypto.randomUUID() };
        body = { ...body, idempotency_key: pending.current.key };
      }
      const r = await api(
        "/api/kryx/adapters/" + a.id + (operation ? "/" + operation : ""),
        operation ? "POST" : "PATCH",
        body,
      );
      if (goal) router.push("/dashboard/tasks/" + r.id);
      else await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tool operation failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="op-section op-adapter">
      <div className="op-heading">
        <h3>{a.manifest.name}</h3>
        <span>{a.state.toLowerCase()}</span>
      </div>
      <p>{a.manifest.description}</p>
      <Link href={"/dashboard/tasks/" + a.goal_id}>Discovery evidence ↗</Link>
      <p className="op-sub">
        Approved network domains: {a.manifest.allowed_domains.join(", ")}
      </p>
      <ul>
        {a.manifest.actions.map((x) => (
          <li key={x.name}>
            <strong>{x.name}</strong> · {x.method} · {x.risk}
            <br />
            <code>{x.url}</code>
            <details>
              <summary>Inputs</summary>
              <pre>{JSON.stringify(x.inputs_schema, null, 2)}</pre>
            </details>
          </li>
        ))}
      </ul>
      {a.manifest.sandbox_result && (
        <div>
          <strong>
            {a.manifest.sandbox_result.passed
              ? "Sandbox passed"
              : "Sandbox failed"}
          </strong>
          <p>
            {new Date(a.manifest.sandbox_result.tested_at).toLocaleString()}
          </p>
          <pre>{a.manifest.sandbox_result.evidence}</pre>
        </div>
      )}
      {error && (
        <p role="alert" className="op-error">
          {error}
        </p>
      )}
      {["DRAFT", "TESTED"].includes(a.state) && (
        <>
          <label>
            Sandbox inputs by action name
            <textarea
              aria-label={"Sandbox inputs for " + a.manifest.name}
              value={examples}
              onChange={(e) => setExamples(e.target.value)}
            />
          </label>
          <p className="op-sub">
            No credentials are used in this test. Authentication failures are
            recorded as failed tests.
          </p>
          <button
            disabled={busy}
            onClick={() => {
              try {
                void mutate("test", { examples: JSON.parse(examples) }, true);
              } catch {
                setError("Enter valid JSON inputs");
              }
            }}
          >
            Create sandbox test plan
          </button>
          {a.state === "TESTED" && (
            <button
              disabled={busy}
              onClick={() =>
                void mutate("install", {
                  approve_install: true,
                  manifest_hash: a.manifest_hash,
                })
              }
            >
              Approve installation of these endpoints
            </button>
          )}
        </>
      )}
      {a.state === "INSTALLED" && (
        <>
          {a.manifest.authentication.type !== "none" && (
            <>
              <p>
                {a.connected
                  ? "Credential connected"
                  : "Credential required for authenticated reads"}
              </p>
              <CredentialForm
                name={a.manifest.name}
                onSave={async (key) => {
                  await api(
                    "/api/kryx/adapters/" + a.id + "/credential",
                    "POST",
                    { key },
                  );
                  await refresh();
                }}
              />
              {a.connected && (
                <button
                  disabled={busy}
                  onClick={() => void mutate("credential", { key: null })}
                >
                  Disconnect credential
                </button>
              )}
            </>
          )}
          <label>
            Read action
            <select value={action} onChange={(e) => setAction(e.target.value)}>
              {a.manifest.actions.map((x) => (
                <option key={x.name}>{x.name}</option>
              ))}
            </select>
          </label>
          <label>
            Read inputs
            <textarea
              aria-label={"Read inputs for " + a.manifest.name}
              value={parameters}
              onChange={(e) => setParameters(e.target.value)}
            />
          </label>
          <button
            disabled={busy}
            onClick={() => {
              try {
                void mutate(
                  "run",
                  { action, parameters: JSON.parse(parameters) },
                  true,
                );
              } catch {
                setError("Enter valid JSON inputs");
              }
            }}
          >
            Create API read plan
          </button>
        </>
      )}
      {a.state !== "DISABLED" && (
        <button
          disabled={busy}
          onClick={() => void mutate("", { action: "disable" })}
        >
          Disable adapter and disconnect credentials
        </button>
      )}
    </article>
  );
}
