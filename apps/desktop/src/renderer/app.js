const root = document.querySelector("#app");

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function render(state) {
  if (!state.connected) {
    root.innerHTML = `
      <section class="auth">
        <div class="mark">K</div>
        <p class="eyebrow">KRYX DESKTOP</p>
        <h1>Your marketing agents,<br/>now on your computer.</h1>
        <p class="lede">Use the same Kryx account. Sign in happens in your browser; this app never asks for your Google password.</p>
        <button id="login" class="primary" ${state.pending ? "disabled" : ""}>
          ${state.pending ? "Finish sign-in in your browser" : "Continue with Kryx"}
        </button>
        <button id="web" class="secondary">Open Web App</button>
        ${state.error ? `<p class="error">${escapeHtml(state.error)}</p>` : ""}
      </section>
    `;
    document.querySelector("#login")?.addEventListener("click", async () => {
      try {
        await window.kryx.login();
      } catch (error) {
        render({ ...state, error: error instanceof Error ? error.message : String(error) });
      }
    });
    document.querySelector("#web")?.addEventListener("click", () => window.kryx.openWeb());
    return;
  }

  const account = state.account || {};
  const name = account.full_name || account.email || "Kryx founder";
  const activeAgents = (state.agents || []).filter(
    (agent) => agent.status === "deployed" && !agent.paused,
  ).length;
  const browserConnected = Boolean(state.browser?.connected);
  const pairingToken = state.browser?.pairingToken || "";
  const observerEnabled = Boolean(state.observerEnabled);
  const macAccessibility = Boolean(state.macAccessibility);
  const allowedLocalApps = Array.isArray(state.allowedLocalApps)
    ? state.allowedLocalApps
    : [];

  root.innerHTML = `
    <header class="topbar">
      <div class="brand"><span class="mark small">K</span><strong>Kryx</strong></div>
      <span class="status"><i></i> Connected</span>
    </header>
    <section class="workspace">
      <p class="eyebrow">THIS MAC</p>
      <h1>${escapeHtml(name)}</h1>
      <p class="lede">Same Kryx account, same agents and credits. Computer-control permissions are granted separately and only when a task needs them.</p>

      <div class="grid">
        <article class="panel">
          <span class="label">Credits</span>
          <strong>${escapeHtml(account.credit_balance ?? "—")}</strong>
          <span class="hint">AI and paid tool work only</span>
        </article>
        <article class="panel">
          <span class="label">Agents</span>
          <strong>${activeAgents}</strong>
          <span class="hint">currently deployed</span>
        </article>
        <article class="panel">
          <span class="label">Local runtime</span>
          <strong>Connected</strong>
          <span class="hint">menu bar + secure device session</span>
        </article>
      </div>

      <div class="notice">
        <div>
          <strong>${browserConnected ? "Chrome bridge connected." : "Connect your Chrome session."}</strong>
          <p>${
            browserConnected
              ? "Kryx can use the browser session you explicitly allowed. Cookies and passwords stay in Chrome."
              : "Load the bundled Kryx Browser Bridge extension, then paste this pairing key into it."
          }</p>
          ${browserConnected ? "" : `
            <div class="pair-row">
              <code>${escapeHtml(pairingToken)}</code>
              <button id="extension" class="secondary">Show extension folder</button>
            </div>
          `}
        </div>
      </div>

      <section class="native-box">
        <div>
          <span class="label">NATIVE APP ACCESS</span>
          <strong>${macAccessibility ? "Accessibility enabled" : "Accessibility required"}</strong>
          <p>Allow only the Mac apps Kryx may inspect locally. Password managers remain outside the device-agent workflow.</p>
        </div>
        <button id="accessibility" class="secondary" ${macAccessibility ? "disabled" : ""}>
          ${macAccessibility ? "Enabled" : "Enable Accessibility"}
        </button>
        <div class="native-apps">
          <label for="allowed-apps">Allowed app names</label>
          <input
            id="allowed-apps"
            value="${escapeHtml(allowedLocalApps.join(", "))}"
            placeholder="Mail, Notion, Slack"
          />
          <button id="save-apps" class="secondary">Save allowed apps</button>
        </div>
      </section>

      <section class="observer-box">
        <div>
          <span class="label">OBSERVER MODE</span>
          <strong>${observerEnabled ? "On" : "Off"}</strong>
          <p>When on, Kryx records only allowed-browser domain/navigation metadata to detect repeated marketing routines. No page text, messages, keystrokes, or screenshots.</p>
        </div>
        <button id="observer-toggle" class="secondary">
          ${observerEnabled ? "Turn off" : "Turn on"}
        </button>
      </section>

      <section class="mission-box">
        <span class="label">MISSION</span>
        <textarea id="mission" rows="3" placeholder="Find 20 SaaS founders who could need Kryx and prepare personalized outreach."></textarea>
        <button id="start-mission" class="primary">Start Mission</button>
        <p class="hint">Kryx chooses browser or native-app execution from the job. Missing permissions become a visible blocker, never a fake success.</p>
      </section>

      ${state.error ? `<p class="error">${escapeHtml(state.error)}</p>` : ""}

      <div class="actions">
        <button id="refresh" class="secondary">Refresh</button>
        <button id="web" class="secondary">Open Web App</button>
        <button id="logout" class="danger">Disconnect this Mac</button>
      </div>
    </section>
  `;

  document.querySelector("#refresh")?.addEventListener("click", () => window.kryx.refresh());
  document.querySelector("#web")?.addEventListener("click", () => window.kryx.openWeb());
  document.querySelector("#logout")?.addEventListener("click", () => window.kryx.logout());
  document.querySelector("#extension")?.addEventListener("click", () => window.kryx.showBrowserExtension());
  document.querySelector("#accessibility")?.addEventListener("click", async () => {
    await window.kryx.requestAccessibility();
  });
  document.querySelector("#save-apps")?.addEventListener("click", async () => {
    const field = document.querySelector("#allowed-apps");
    const apps = String(field?.value || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    await window.kryx.setAllowedLocalApps(apps);
  });
  document.querySelector("#observer-toggle")?.addEventListener("click", async () => {
    const button = document.querySelector("#observer-toggle");
    if (!button) return;
    button.disabled = true;
    try {
      await window.kryx.setObserver(!observerEnabled);
    } finally {
      button.disabled = false;
    }
  });
  document.querySelector("#start-mission")?.addEventListener("click", async () => {
    const field = document.querySelector("#mission");
    const button = document.querySelector("#start-mission");
    const instruction = field?.value?.trim() || "";
    if (!instruction || !button) return;

    button.disabled = true;
    button.textContent = "Starting…";
    try {
      const result = await window.kryx.startMission(instruction);
      field.value = "";
      button.textContent = result?.status === "blocked" ? "Blocked" : "Mission started";
      setTimeout(() => {
        button.textContent = "Start Mission";
        button.disabled = false;
      }, 1600);
    } catch (error) {
      button.textContent = "Could not start";
      setTimeout(() => {
        button.textContent = "Start Mission";
        button.disabled = false;
      }, 1600);
    }
  });
}

const unsubscribe = window.kryx.onState(render);
window.addEventListener("beforeunload", () => unsubscribe?.());
window.kryx.getState().then(render);


window.kryx.onFocusMission?.(() => {
  const field = document.querySelector("#mission");
  field?.focus();
  field?.scrollIntoView({ behavior: "smooth", block: "center" });
});
