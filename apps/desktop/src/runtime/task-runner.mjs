import { createPublicKey, verify } from "node:crypto";

const MAX_SOURCE_TEXT = 8_000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeUrl(raw) {
  try {
    const value = String(raw || "").trim();
    if (!value) return null;
    const url = new URL(value.startsWith("http") ? value : `https://${value}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function sourceEvidence(title, snapshot, fallbackUrl) {
  const sourceUrl = normalizeUrl(snapshot?.url) || normalizeUrl(fallbackUrl);
  const text = String(snapshot?.text || "").slice(0, MAX_SOURCE_TEXT);
  const item = {
    kind: "source",
    title: String(title || snapshot?.title || "Browser source").slice(0, 300),
    content: {
      visibleText: text,
      pageTitle: String(snapshot?.title || "").slice(0, 500),
      sourceTrust: "untrusted_external_content",
      capturedAt: new Date().toISOString(),
    },
  };
  if (sourceUrl) item.sourceUrl = sourceUrl;
  return item;
}

function looksLikeHumanVerification(snapshot) {
  const text = String(snapshot?.text || "").toLowerCase();
  return [
    "captcha",
    "verify you are human",
    "unusual traffic",
    "two-step verification",
    "2-step verification",
    "enter verification code",
    "confirm it's you",
  ].some((needle) => text.includes(needle));
}

function externalLinks(snapshot) {
  const seen = new Set();
  const result = [];
  for (const item of snapshot?.interactive || []) {
    const href = normalizeUrl(item?.href);
    if (!href) continue;
    let url;
    try { url = new URL(href); } catch { continue; }
    if (url.hostname.endsWith("google.com")) continue;
    if (seen.has(url.href)) continue;
    seen.add(url.href);
    result.push({
      href: url.href,
      title: String(item?.text || item?.label || url.hostname).trim().slice(0, 220),
    });
    if (result.length >= 6) break;
  }
  return result;
}

function researchQuery(instruction) {
  const cleaned = String(instruction || "")
    .replace(/\b(open|browser|research|find|prepare|create|summary|summarize)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return (cleaned || instruction).slice(0, 180);
}

function accessibleText(value, maxChars = 24_000) {
  const chunks = [];
  const seen = new Set();

  function walk(node, key = "", depth = 0) {
    if (depth > 12 || chunks.join("\n").length >= maxChars) return;
    if (node == null) return;

    const lowerKey = String(key).toLowerCase();
    if (/image|screenshot|base64|png|jpeg|binary|bytes/.test(lowerKey)) return;

    if (typeof node === "string") {
      const text = node.trim();
      if (!text || text.length > 6_000) return;
      if (!seen.has(text)) {
        seen.add(text);
        chunks.push(text);
      }
      return;
    }

    if (Array.isArray(node)) {
      for (const item of node) walk(item, key, depth + 1);
      return;
    }

    if (typeof node === "object") {
      for (const [childKey, child] of Object.entries(node)) {
        walk(child, childKey, depth + 1);
      }
    }
  }

  walk(value);
  return chunks.join("\n").slice(0, maxChars);
}

function resolveAllowedApp(instruction, allowedApps) {
  const text = String(instruction || "").toLowerCase();
  return [...allowedApps]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .find((name) => text.includes(name.toLowerCase())) || null;
}

function collectAppNames(value) {
  const names = new Set();

  function walk(node, key = "", depth = 0) {
    if (depth > 8 || node == null) return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item, key, depth + 1);
      return;
    }
    if (typeof node !== "object") return;

    for (const [childKey, child] of Object.entries(node)) {
      const k = String(childKey).toLowerCase();
      if (
        typeof child === "string" &&
        /^(name|app|application|title|process_name|display_name)$/.test(k)
      ) {
        const text = child.trim();
        if (text && text.length <= 160) names.add(text);
      } else {
        walk(child, childKey, depth + 1);
      }
    }
  }

  walk(value);
  return [...names];
}

function resolveInstalledApp(instruction, appListing) {
  const text = String(instruction || "").toLowerCase();
  return collectAppNames(appListing)
    .sort((a, b) => b.length - a.length)
    .find((name) => text.includes(name.toLowerCase())) || null;
}

function dependencyActionPlan(task) {
  const context = Array.isArray(task?.dependency_context) ? task.dependency_context : [];
  for (let index = context.length - 1; index >= 0; index -= 1) {
    const output = context[index]?.output;
    const raw =
      typeof output?.content === "string"
        ? output.content
        : typeof output === "string"
          ? output
          : "";

    if (!raw) continue;
    let value = raw.trim();
    value = value.replace(/^\x60\x60\x60(?:json)?\s*/i, "").replace(/\s*\x60\x60\x60$/, "");
    const start = value.indexOf("{");
    const end = value.lastIndexOf("}");
    if (start < 0 || end <= start) continue;
    try {
      return JSON.parse(value.slice(start, end + 1));
    } catch {}
  }
  return null;
}

function assertSafeExternalAction(instruction, operation) {
  const text = `${instruction || ""} ${operation || ""}`.toLowerCase();
  const denied = [
    "delete",
    "erase",
    "remove account",
    "deactivate account",
    "uninstall",
    "factory reset",
    "purchase",
    "buy ",
    "payment",
    "pay ",
    "transfer money",
    "bank",
    "password",
    "change password",
    "security settings",
    "2fa",
    "two-factor",
    "otp",
    "install software",
    "grant permission",
    "revoke permission",
  ];
  const hit = denied.find((term) => text.includes(term));
  if (hit) {
    throw new Error(
      "Kryx V1 blocks destructive, financial and account-security actions on devices.",
    );
  }
}

function findInteractive(snapshot, terms, { editable = false, exact = false } = {}) {
  const candidates = Array.isArray(snapshot?.interactive) ? snapshot.interactive : [];
  const needles = terms.map((term) => String(term || "").trim().toLowerCase()).filter(Boolean);

  const filtered = candidates.filter((item) => {
    if (String(item?.inputType || "").toLowerCase() === "password") return false;
    if (editable) {
      const tag = String(item?.tag || "").toLowerCase();
      const role = String(item?.role || "").toLowerCase();
      const inputType = String(item?.inputType || "").toLowerCase();
      const looksEditable =
        ["input", "textarea", "select"].includes(tag) ||
        role === "textbox" ||
        inputType === "text" ||
        inputType === "search" ||
        item?.contentEditable === true;
      if (!looksEditable) return false;
    }

    const haystack = [
      item?.label,
      item?.text,
      item?.value,
      item?.href,
      item?.role,
      item?.tag,
    ]
      .map((value) => String(value || "").trim().toLowerCase())
      .filter(Boolean);

    if (!needles.length) return true;

    return needles.some((needle) =>
      haystack.some((value) => (exact ? value === needle : value.includes(needle))),
    );
  });

  return filtered[0] || null;
}

function localWebAppUrl(instruction) {
  const text = String(instruction || "").toLowerCase();
  const wantsMessages = /dm|message|inbox|chat/.test(text);

  if (/\bx\b|twitter/.test(text)) {
    return wantsMessages ? "https://x.com/messages" : "https://x.com/home";
  }
  if (/gmail|email/.test(text)) {
    return "https://mail.google.com/mail/u/0/#inbox";
  }
  if (/linkedin/.test(text)) {
    return wantsMessages
      ? "https://www.linkedin.com/messaging/"
      : "https://www.linkedin.com/feed/";
  }
  if (/notion/.test(text)) return "https://www.notion.so/";
  if (/slack/.test(text)) return "https://app.slack.com/client";
  if (/whatsapp/.test(text)) return "https://web.whatsapp.com/";
  if (/instagram/.test(text)) {
    return wantsMessages
      ? "https://www.instagram.com/direct/inbox/"
      : "https://www.instagram.com/";
  }
  if (/messenger|facebook/.test(text)) return "https://www.messenger.com/";
  return null;
}

export class DesktopTaskRunner {
  constructor({
    request,
    browserBridge,
    computerController,
    allowedApps,
    approveAppOpen,
    readState,
    writeState,
    notify,
  }) {
    this.request = request;
    this.browserBridge = browserBridge;
    this.computerController = computerController;
    this.allowedApps = allowedApps;
    this.approveAppOpen = approveAppOpen;
    this.readState = readState;
    this.writeState = writeState;
    this.notify = notify;
    this.busy = false;
  }

  async pollOnce() {
    if (this.busy) return false;
    this.busy = true;
    try {
      const advanced = await this.advanceOnePendingMission();
      const response = await this.request("/api/device/tasks/next", { method: "GET" });
      if (!response?.task) return advanced;

      const task = this.verifyEnvelope(response.task);
      await this.runTask(task);
      return true;
    } finally {
      this.busy = false;
    }
  }

  verifyEnvelope(envelope) {
    if (envelope?.alg !== "Ed25519" || envelope?.kid !== "kryx-device-v1") {
      throw new Error("Kryx blocked an unknown task signature.");
    }

    const state = this.readState();
    const keyB64 = String(state.taskSigningPublicKeyB64 || "").trim();
    if (!keyB64) {
      throw new Error("This Mac has no trusted Kryx task verification key. Reconnect it.");
    }

    const payloadBytes = Buffer.from(String(envelope.payload || ""), "base64url");
    const signature = Buffer.from(String(envelope.signature || ""), "base64url");
    const publicKey = createPublicKey({
      key: Buffer.from(keyB64, "base64"),
      format: "der",
      type: "spki",
    });

    if (!verify(null, payloadBytes, publicKey, signature)) {
      throw new Error("Kryx task signature verification failed.");
    }

    const payload = JSON.parse(payloadBytes.toString("utf8"));
    if (payload.version !== 1) throw new Error("Unsupported Kryx task version.");
    if (Date.parse(payload.expires_at) <= Date.now()) throw new Error("Kryx task envelope expired.");

    const localDeviceId = state.session?.device?.id;
    if (!localDeviceId || payload.device_id !== localDeviceId) {
      throw new Error("Task was signed for a different Kryx device.");
    }

    return payload;
  }

  async runTask(task) {
    await this.persist({ activeTask: task });
    try {
      await this.postState(task, "running");

      if (task.task_type === "browser.research") {
        await this.runBrowserResearch(task);
      } else if (task.task_type === "app.inspect") {
        await this.runAppInspect(task);
      } else if (task.task_type === "app.action") {
        await this.runAppAction(task);
      } else {
        throw new Error(`Unsupported desktop task type: ${task.task_type}`);
      }
      await this.rememberMission(task.mission_id);
      await this.persist({ activeTask: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const rejected = /founder rejected|rejected opening/i.test(message);
      const needsUser =
        /permission|accessibility|not allowed|allow-list|sign.?in|login|verification|captcha|2fa|could not safely|not find/i.test(message);

      await this.postState(task, rejected ? "failed" : needsUser ? "waiting_for_user" : "failed", {
        errorCode: rejected
          ? "founder_rejected"
          : needsUser
            ? "device_attention_required"
            : "desktop_execution_failed",
        errorMessage: message,
        evidence: [
          {
            kind: needsUser ? "ui_receipt" : "error",
            title: needsUser ? "Browser needs you" : "Mac execution failed",
            content: { message, at: new Date().toISOString() },
          },
        ],
      }).catch(() => {});

      if (!needsUser) await this.persist({ activeTask: null });
      throw error;
    }
  }

  async runBrowserResearch(task) {
    const allowed = new Set(task.allowed_actions || []);
    for (const action of ["open_url", "inspect_ui"]) {
      if (!allowed.has(action)) {
        throw new Error(`Signed task policy does not allow browser action: ${action}`);
      }
    }

    if (!this.browserBridge.status().connected) {
      throw new Error("Browser permission required: connect the Kryx Chrome bridge.");
    }

    const query = researchQuery(task.instruction);
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;

    const opened = await this.browserBridge.call("tabs.open", { url: searchUrl, active: true });
    await sleep(1800);

    const search = await this.browserBridge.call("page.read", { tabId: opened.id });
    if (looksLikeHumanVerification(search)) {
      throw new Error("Browser verification required. Complete CAPTCHA or account verification and resume.");
    }

    const evidence = [sourceEvidence("Search results", search, searchUrl)];
    const links = externalLinks(search);
    let visited = 0;

    for (const candidate of links.slice(0, 3)) {
      let tab = null;
      try {
        tab = await this.browserBridge.call("tabs.open", {
          url: candidate.href,
          active: false,
        });
        await sleep(1500);
        const page = await this.browserBridge.call("page.read", { tabId: tab.id });

        if (looksLikeHumanVerification(page)) {
          throw new Error("Browser verification required on a source page.");
        }

        evidence.push(sourceEvidence(candidate.title, page, candidate.href));
        visited += 1;
      } catch (error) {
        evidence.push({
          kind: "note",
          title: `Could not inspect ${candidate.title || candidate.href}`,
          sourceUrl: candidate.href,
          content: {
            message: error instanceof Error ? error.message : String(error),
            sourceTrust: "untrusted_external_content",
          },
        });
      } finally {
        if (tab?.id) {
          await this.browserBridge.call("tabs.close", { tabId: tab.id }).catch(() => {});
        }
      }
    }

    const output = {
      query,
      sourcesCaptured: evidence.filter((item) => item.kind === "source").length,
      sourcesVisited: visited,
      deviceMethod: "chrome_structured_bridge",
      collectedAt: new Date().toISOString(),
    };

    await this.postState(task, "completed", { output, evidence });
    this.notify?.("Kryx research finished", "Local browser evidence is ready and the cloud squad is continuing.");
  }

  async runAppInspect(task) {
    if (!this.computerController) {
      throw new Error("Mac accessibility controller is unavailable.");
    }

    const allowedActions = new Set(task.allowed_actions || []);
    for (const action of ["open_app", "inspect_ui"]) {
      if (!allowedActions.has(action)) {
        throw new Error(`Signed task policy does not allow Mac action: ${action}`);
      }
    }

    const allowed = typeof this.allowedApps === "function" ? this.allowedApps() : [];
    const appName = resolveAllowedApp(task.instruction, allowed);

    let visibleText = "";
    let sourceLabel = "";
    let deviceMethod = "";

    if (appName) {
      await this.computerController.openApp(appName);
      await sleep(1200);

      const state = await this.computerController.getAppState(appName);
      visibleText = accessibleText(state);
      sourceLabel = appName;
      deviceMethod = "macos_accessibility";

      if (!visibleText.trim()) {
        throw new Error(
          "Accessibility permission is missing or this app did not expose readable UI text.",
        );
      }
    } else {
      const webUrl = localWebAppUrl(task.instruction);
      if (!webUrl || !this.browserBridge?.status().connected) {
        throw new Error(
          "App not allowed. Add the exact native app name in Kryx Desktop, or connect Chrome for supported signed-in web apps.",
        );
      }

      const tab = await this.browserBridge.call("tabs.open", {
        url: webUrl,
        active: true,
      });
      await sleep(1200);
      const page = await this.browserBridge.call("page.read", { tabId: tab.id });
      visibleText = String(page?.text || "").slice(0, 24_000);
      sourceLabel = new URL(webUrl).hostname;
      deviceMethod = "local_chrome_session";

      if (!visibleText.trim()) {
        throw new Error("The local browser page did not expose readable content.");
      }
    }

    if (looksLikeHumanVerification({ text: visibleText })) {
      throw new Error("Account verification is required before Kryx can continue.");
    }

    const summarized = await this.request("/api/device/private-summary", {
      method: "POST",
      body: JSON.stringify({
        taskId: task.task_id,
        nonce: task.nonce,
        visibleText,
        request: task.instruction,
        appLabel: sourceLabel,
      }),
    });

    const summary = String(summarized?.summary || "").trim();
    if (!summary) throw new Error("Kryx did not receive a usable local-app summary.");

    const output = {
      summary,
      app: sourceLabel,
      rawContextPersisted: false,
      creditsUsed: Number(summarized?.creditsUsed || 0),
      deviceMethod,
      completedAt: new Date().toISOString(),
    };

    const evidence = [
      {
        kind: "action_receipt",
        title: `${sourceLabel} inspected locally`,
        content: {
          action: "inspect_ui",
          app: sourceLabel,
          method: deviceMethod,
          rawContextPersisted: false,
          capturedAt: new Date().toISOString(),
        },
      },
      {
        kind: "note",
        title: "Kryx summary",
        content: {
          summary,
          app: sourceLabel,
          privateContext: true,
          rawContextPersisted: false,
        },
      },
    ];

    await this.postState(task, "completed", { output, evidence });
    this.notify?.("Kryx finished", `${sourceLabel} summary is ready.`);
  }

  async postState(task, status, extra = {}) {
    const body = {
      nonce: task.nonce,
      status,
      evidence: extra.evidence || [],
    };
    if (extra.output) body.output = extra.output;
    if (extra.errorCode) body.errorCode = extra.errorCode;
    if (extra.errorMessage) body.errorMessage = extra.errorMessage;

    return this.request(`/api/device/tasks/${task.task_id}/status`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async rememberMission(missionId) {
    const state = this.readState();
    const current = Array.isArray(state.missionsToAdvance) ? state.missionsToAdvance : [];
    if (!current.includes(missionId)) current.push(missionId);
    await this.persist({ missionsToAdvance: current });
  }

  async advanceOnePendingMission() {
    const state = this.readState();
    const pending = Array.isArray(state.missionsToAdvance) ? state.missionsToAdvance : [];
    if (!pending.length) return false;

    const missionId = pending[0];
    const snapshot = await this.request(`/api/device/missions/${missionId}`, { method: "GET" });
    const status = snapshot?.mission?.status;

    if (["completed", "failed", "cancelled"].includes(status)) {
      await this.persist({ missionsToAdvance: pending.slice(1) });
      if (status === "completed") {
        this.notify?.("Kryx mission finished", snapshot?.mission?.summary || "Finished work is ready.");
      }
      return false;
    }

    await this.request(`/api/device/missions/${missionId}/advance`, {
      method: "POST",
      body: "{}",
    });
    return true;
  }

  async persist(patch) {
    const state = this.readState();
    Object.assign(state, patch);
    await this.writeState(state);
  }
}
