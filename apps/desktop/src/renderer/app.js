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

      <section class="mission-box">
        <span class="label">MISSION</span>
        <textarea id="mission" rows="3" placeholder="Find 20 SaaS founders who could need Kryx and prepare personalized outreach."></textarea>
        <button id="start-mission" class="primary" ${browserConnected ? "" : "disabled"}>Start Mission</button>
        <p class="hint">${browserConnected ? "Kryx will show real progress and evidence. External publishing/sending still requires approval." : "Connect Chrome before starting a local browser mission."}</p>
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
        button.disabled = !browserConnected;
      }, 1600);
    } catch (error) {
      button.textContent = "Could not start";
      setTimeout(() => {
        button.textContent = "Start Mission";
        button.disabled = !browserConnected;
      }, 1600);
    }
  });
}

const unsubscribe = window.kryx.onState(render);
window.addEventListener("beforeunload", () => unsubscribe?.());
window.kryx.getState().then(render);
