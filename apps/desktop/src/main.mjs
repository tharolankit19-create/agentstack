import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  nativeImage,
  Notification,
  safeStorage,
  shell,
  systemPreferences,
  Tray,
} from "electron";
import {
  createHash,
  generateKeyPairSync,
  randomBytes,
  randomUUID,
} from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BrowserBridge } from "./runtime/browser-bridge.mjs";
import { DesktopTaskRunner } from "./runtime/task-runner.mjs";
import { ComputerController } from "./runtime/computer-controller.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_BASE = (process.env.KRYX_API_URL || "https://getkryxai.com").replace(/\/+$/, "");
const HEARTBEAT_MS = 30_000;
const REFRESH_EARLY_MS = 2 * 60 * 1000;

let windowRef = null;
let tray = null;
let heartbeatTimer = null;
let taskTimer = null;
let browserBridge = null;
let computerController = null;
let taskRunner = null;
let quitting = false;
let state = {
  installationId: null,
  browserPairingToken: null,
  publicKey: null,
  privateKey: null,
  pendingAuth: null,
  session: null,
  account: null,
  agents: [],
  observerEnabled: false,
  observerEvents: [],
  allowedLocalApps: [],
  error: null,
};

function platformKey() {
  if (process.platform === "darwin") return "macos";
  if (process.platform === "win32") return "windows";
  if (process.platform === "linux") return "linux";
  throw new Error(`Unsupported Kryx Desktop platform: ${process.platform}`);
}

function platformLabel() {
  if (process.platform === "darwin") return "Mac";
  if (process.platform === "win32") return "Windows PC";
  if (process.platform === "linux") return "Linux PC";
  return "Computer";
}

function accessibilityAvailable() {
  if (process.platform === "darwin") {
    return systemPreferences.isTrustedAccessibilityClient(false);
  }
  return process.platform === "win32" || process.platform === "linux";
}

function storePath() {
  return path.join(app.getPath("userData"), "kryx-secure-state.bin");
}

async function encryptString(value) {
  if (typeof safeStorage.encryptStringAsync === "function") {
    return safeStorage.encryptStringAsync(value);
  }
  return safeStorage.encryptString(value);
}

async function decryptString(value) {
  if (typeof safeStorage.decryptStringAsync === "function") {
    return safeStorage.decryptStringAsync(value);
  }
  return safeStorage.decryptString(value);
}

async function saveState() {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("Secure encrypted storage is unavailable on this computer.");
  }
  const encrypted = await encryptString(JSON.stringify(state));
  await fs.mkdir(path.dirname(storePath()), { recursive: true });
  await fs.writeFile(storePath(), encrypted, { mode: 0o600 });
}

async function loadState() {
  try {
    const encrypted = await fs.readFile(storePath());
    if (!safeStorage.isEncryptionAvailable()) return;
    const raw = await decryptString(encrypted);
    const parsed = JSON.parse(raw);
    state = { ...state, ...parsed, error: null };
  } catch (error) {
    if (error?.code !== "ENOENT") {
      console.error("[desktop] secure state could not be loaded", error);
    }
  }

  if (!state.installationId) state.installationId = randomUUID();
  if (!state.browserPairingToken) {
    state.browserPairingToken = randomBytes(24).toString("base64url");
  }
  if (!state.publicKey || !state.privateKey) {
    const pair = generateKeyPairSync("ed25519");
    state.publicKey = pair.publicKey.export({ type: "spki", format: "pem" });
    state.privateKey = pair.privateKey.export({ type: "pkcs8", format: "pem" });
  }
  await saveState();
}

function publicState() {
  return {
    connected: Boolean(state.session?.deviceToken),
    pending: Boolean(state.pendingAuth),
    account: state.account,
    agents: state.agents,
    device: state.session?.device ?? null,
    browser: {
      connected: Boolean(browserBridge?.status().connected),
      pairingToken: state.browserPairingToken,
    },
    observerEnabled: Boolean(state.observerEnabled),
    allowedLocalApps: Array.isArray(state.allowedLocalApps) ? state.allowedLocalApps : [],
    platform: platformKey(),
    platformLabel: platformLabel(),
    localAccessibility: accessibilityAvailable(),
    error: state.error,
    apiBase: API_BASE,
  };
}

function emitState() {
  windowRef?.webContents.send("kryx:state", publicState());
  rebuildTray();
}

async function requestJson(route, options = {}) {
  const response = await fetch(`${API_BASE}${route}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || `Kryx returned ${response.status}.`);
  }
  return data;
}

function challengeFor(verifier) {
  return createHash("sha256").update(verifier).digest("base64url");
}

async function beginLogin() {
  const codeVerifier = randomBytes(48).toString("base64url").slice(0, 64);
  const loginState = randomBytes(32).toString("base64url");

  const data = await requestJson("/api/desktop/auth/start", {
    method: "POST",
    body: JSON.stringify({
      installationId: state.installationId,
      deviceName: os.hostname() || platformLabel(),
      platform: platformKey(),
      osVersion: os.release(),
      appVersion: app.getVersion(),
      state: loginState,
      codeChallenge: challengeFor(codeVerifier),
      redirectUri: "kryx://auth/callback",
      publicKey: state.publicKey,
      capabilities: {
        menu_bar: true,
        notifications: true,
        local_runtime: true,
        browser_control: Boolean(browserBridge?.status().connected),
        accessibility_control: accessibilityAvailable(),
        file_access: true,
        terminal_control: false
      },
      permissions: {
        browser_bridge_connected: Boolean(browserBridge?.status().connected)
      }
    }),
  });

  state.pendingAuth = {
    requestId: data.requestId,
    state: loginState,
    codeVerifier,
    expiresAt: data.expiresAt,
  };
  state.error = null;
  await saveState();
  emitState();

  await shell.openExternal(data.authorizeUrl);
  return publicState();
}

async function exchangeDeepLink(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return;
  }

  if (url.protocol !== "kryx:" || url.hostname !== "auth" || url.pathname !== "/callback") {
    return;
  }

  const pending = state.pendingAuth;
  const requestId = url.searchParams.get("request");
  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");

  if (
    !pending ||
    !requestId ||
    !code ||
    returnedState !== pending.state ||
    requestId !== pending.requestId
  ) {
    state.error = "The desktop sign-in callback did not match this Kryx request.";
    emitState();
    return;
  }

  try {
    const data = await requestJson("/api/desktop/auth/exchange", {
      method: "POST",
      body: JSON.stringify({
        requestId,
        code,
        state: returnedState,
        codeVerifier: pending.codeVerifier,
      }),
    });

    state.session = {
      device: data.device,
      deviceToken: data.deviceToken,
      deviceRefreshToken: data.deviceRefreshToken,
      deviceTokenExpiresAt: data.deviceTokenExpiresAt,
      deviceRefreshExpiresAt: data.deviceRefreshExpiresAt,
    };
    state.taskSigningPublicKeyB64 = data.taskSigningPublicKeyB64;
    state.pendingAuth = null;
    state.error = null;
    await saveState();
    await loadAccount();
    startHeartbeat();
    startTaskPolling();

    if (Notification.isSupported()) {
      new Notification({
        title: "Kryx connected",
        body: "This Mac is connected to your existing Kryx account.",
      }).show();
    }

    windowRef?.show();
    windowRef?.focus();
  } catch (error) {
    state.error = error instanceof Error ? error.message : "Desktop sign-in failed.";
    emitState();
  }
}

async function rotateIfNeeded() {
  if (!state.session?.deviceRefreshToken) return false;

  const expiresAt = Date.parse(state.session.deviceTokenExpiresAt || "");
  if (Number.isFinite(expiresAt) && expiresAt - Date.now() > REFRESH_EARLY_MS) {
    return true;
  }

  const data = await requestJson("/api/desktop/session", {
    method: "POST",
    headers: {
      authorization: `Device-Refresh ${state.session.deviceRefreshToken}`,
    },
    body: "{}",
  });

  state.session = {
    ...state.session,
    deviceToken: data.deviceToken,
    deviceRefreshToken: data.deviceRefreshToken,
    deviceTokenExpiresAt: data.deviceTokenExpiresAt,
    deviceRefreshExpiresAt: data.deviceRefreshExpiresAt,
  };
  await saveState();
  return true;
}

async function deviceRequest(route, options = {}) {
  if (!state.session?.deviceToken) throw new Error("Kryx Desktop is not signed in.");
  await rotateIfNeeded();
  return requestJson(route, {
    ...options,
    headers: {
      ...(options.headers || {}),
      authorization: `Device ${state.session.deviceToken}`,
    },
  });
}

async function loadAccount() {
  if (!state.session?.deviceToken) {
    emitState();
    return;
  }
  try {
    const data = await deviceRequest("/api/desktop/me", { method: "GET" });
    state.account = data.account;
    state.agents = data.agents || [];
    state.error = null;
  } catch (error) {
    state.error = error instanceof Error ? error.message : "Could not load Kryx.";
  }
  await saveState();
  emitState();
}

async function heartbeat() {
  if (!state.session?.deviceToken) return;
  try {
    await deviceRequest("/api/desktop/heartbeat", {
      method: "POST",
      body: JSON.stringify({
        appVersion: app.getVersion(),
        osVersion: os.release(),
        capabilities: {
          menu_bar: true,
          notifications: true,
          local_runtime: true,
          browser_control: Boolean(browserBridge?.status().connected),
          accessibility_control: accessibilityAvailable(),
          file_access: true,
          terminal_control: false
        },
        permissions: {
          browser_bridge_connected: Boolean(browserBridge?.status().connected)
        }
      }),
    });
    state.error = null;
  } catch (error) {
    state.error = error instanceof Error ? error.message : "Kryx heartbeat failed.";
  }
  emitState();
}

function startHeartbeat() {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = setInterval(() => void heartbeat(), HEARTBEAT_MS);
  void heartbeat();
}

function recordDesktopObserverEvent(event) {
  if (!state.observerEnabled || !event || typeof event !== "object") return;

  const safeEvent = {
    observedAt:
      typeof event.observedAt === "string"
        ? event.observedAt
        : new Date().toISOString(),
    appId: String(event.appId || "com.google.Chrome").slice(0, 240),
    windowClass:
      typeof event.windowClass === "string"
        ? event.windowClass.slice(0, 300)
        : undefined,
    eventType: String(event.eventType || "navigation").slice(0, 120),
    domain:
      typeof event.domain === "string"
        ? event.domain.toLowerCase().slice(0, 300)
        : undefined,
    elementRole:
      typeof event.elementRole === "string"
        ? event.elementRole.slice(0, 180)
        : undefined,
  };

  const events = Array.isArray(state.observerEvents) ? state.observerEvents : [];
  events.push(safeEvent);
  state.observerEvents = events.slice(-80);
  void saveState();
}

async function flushDesktopObserver() {
  if (!state.observerEnabled || !state.session?.deviceToken) return;
  const events = Array.isArray(state.observerEvents) ? state.observerEvents : [];
  if (!events.length) return;

  const batch = events.slice(0, 50);
  const result = await deviceRequest("/api/device/observer/events", {
    method: "POST",
    body: JSON.stringify({ events: batch }),
  });

  state.observerEvents = events.slice(batch.length);
  await saveState();

  if (result?.workflowDetected) {
    notify(
      "Kryx noticed a repeated workflow",
      "Open Kryx to review it. Nothing was automated automatically.",
    );
  }
}

function notify(title, body) {
  if (!Notification.isSupported()) return;
  new Notification({ title, body }).show();
}

function startTaskPolling() {
  if (taskTimer) clearInterval(taskTimer);
  if (!taskRunner) return;
  taskTimer = setInterval(() => {
    if (!state.session?.deviceToken) return;
    void flushDesktopObserver().catch(() => {});
    void taskRunner.pollOnce().catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      if (!/Kryx returned 204|no trusted|not signed in/i.test(message)) {
        state.error = message;
        emitState();
      }
    });
  }, 20_000);

  if (state.session?.deviceToken) {
    void taskRunner.pollOnce().catch(() => {});
  }
}

function browserExtensionPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, "browser-extension")
    : path.join(app.getAppPath(), "browser-extension");
}

async function startBrowserRuntime() {
  browserBridge = new BrowserBridge({
    token: state.browserPairingToken,
    onStatus: async () => {
      emitState();
      if (browserBridge?.status().connected) {
        await browserBridge
          .call("observer.set", { enabled: Boolean(state.observerEnabled) })
          .catch(() => {});
      }
      if (state.session?.deviceToken) await heartbeat().catch(() => {});
    },
    onObserverEvent: recordDesktopObserverEvent,
  });
  await browserBridge.start();

  computerController = new ComputerController({ allowForeground: false });

  taskRunner = new DesktopTaskRunner({
    request: deviceRequest,
    browserBridge,
    computerController,
    allowedApps: () =>
      Array.isArray(state.allowedLocalApps) ? state.allowedLocalApps : [],
    readState: () => state,
    writeState: async (nextState) => {
      state = nextState;
      await saveState();
      emitState();
    },
    notify,
  });

  startTaskPolling();
}

async function signOut() {
  try {
    if (state.session?.deviceToken) {
      await deviceRequest("/api/desktop/revoke", { method: "POST", body: "{}" });
    }
  } catch (error) {
    console.warn("[desktop] remote revoke during logout failed", error);
  }

  state.session = null;
  state.account = null;
  state.agents = [];
  state.pendingAuth = null;
  state.observerEnabled = false;
  state.observerEvents = [];
  state.allowedLocalApps = [];
  state.error = null;
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = null;
  if (taskTimer) clearInterval(taskTimer);
  taskTimer = null;
  await saveState();
  emitState();
}

function trayIcon() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18">
    <path fill="black" d="M3 2.5h4.3v5.1L12 2.5h3L10.2 8l4.9 7.5H12l-4.7-7v7H3z"/>
  </svg>`;
  const image = nativeImage.createFromDataURL(
    `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`,
  );
  image.setTemplateImage(true);
  return image;
}

function rebuildTray() {
  if (!tray) return;
  const connected = Boolean(state.session?.deviceToken);
  const label = connected
    ? state.error
      ? "Connected · attention needed"
      : "Connected"
    : "Not connected";

  tray.setToolTip(`Kryx — ${label}`);
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: `Kryx — ${label}`, enabled: false },
      { type: "separator" },
      {
        label: "Give Kryx a task…",
        click: () => {
          windowRef?.show();
          windowRef?.focus();
          windowRef?.webContents.send("kryx:focus-mission");
        },
      },
      { label: "Open Kryx", click: () => { windowRef?.show(); windowRef?.focus(); } },
      { label: "Open Web App", click: () => void shell.openExternal(`${API_BASE}/dashboard`) },
      ...(connected ? [{ label: `Disconnect this ${platformLabel()}`, click: () => void signOut() }] : []),
      { type: "separator" },
      { label: "Quit Kryx", click: () => { quitting = true; app.quit(); } },
    ]),
  );
}

function createWindow() {
  windowRef = new BrowserWindow({
    width: 920,
    height: 640,
    minWidth: 760,
    minHeight: 520,
    titleBarStyle: "hiddenInset",
    backgroundColor: "#0b0c0e",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  windowRef.loadFile(path.join(__dirname, "renderer", "index.html"));
  windowRef.once("ready-to-show", () => windowRef?.show());

  windowRef.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//i.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  windowRef.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith("file:")) event.preventDefault();
  });

  windowRef.on("close", (event) => {
    if (!quitting) {
      event.preventDefault();
      windowRef?.hide();
    }
  });
}

function installIpc() {
  ipcMain.handle("kryx:get-state", () => publicState());
  ipcMain.handle("kryx:login", () => beginLogin());
  ipcMain.handle("kryx:refresh", async () => {
    await loadAccount();
    return publicState();
  });
  ipcMain.handle("kryx:logout", async () => {
    await signOut();
    return publicState();
  });
  ipcMain.handle("kryx:open-web", () => shell.openExternal(`${API_BASE}/dashboard`));
  ipcMain.handle("kryx:show-browser-extension", () => {
    shell.showItemInFolder(path.join(browserExtensionPath(), "manifest.json"));
  });
  ipcMain.handle("kryx:request-accessibility", async () => {
    if (process.platform !== "darwin") {
      emitState();
      if (state.session?.deviceToken) await heartbeat().catch(() => {});
      return true;
    }
    const trusted = systemPreferences.isTrustedAccessibilityClient(true);
    emitState();
    if (state.session?.deviceToken) await heartbeat().catch(() => {});
    return trusted;
  });

  ipcMain.handle("kryx:set-allowed-local-apps", async (_event, apps) => {
    const values = Array.isArray(apps)
      ? [...new Set(
          apps
            .map((value) => String(value || "").trim())
            .filter(Boolean)
            .slice(0, 100),
        )]
      : [];

    state.allowedLocalApps = values;
    await saveState();
    emitState();
    return publicState();
  });

  ipcMain.handle("kryx:set-observer", async (_event, enabled) => {
    if (!state.session?.deviceToken) {
      throw new Error("Connect your Kryx account first.");
    }

    const next = Boolean(enabled);
    await deviceRequest("/api/device/observer", {
      method: "POST",
      body: JSON.stringify({
        enabled: next,
        excludedApps: [],
        anonymousImprovement: false,
      }),
    });

    state.observerEnabled = next;
    if (!next) state.observerEvents = [];
    await saveState();

    if (browserBridge?.status().connected) {
      await browserBridge.call("observer.set", { enabled: next }).catch(() => {});
    }

    emitState();
    return publicState();
  });

  ipcMain.handle("kryx:start-mission", async (_event, instruction) => {
    const text = String(instruction || "").trim();
    if (!text) throw new Error("Describe the marketing job first.");
    const result = await deviceRequest("/api/device/tasks", {
      method: "POST",
      body: JSON.stringify({
        instruction: text,
        requestedExecution: platformKey(),
      }),
    });
    startTaskPolling();
    return result;
  });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    const deepLink = argv.find((arg) => arg.startsWith("kryx://"));
    if (deepLink) void exchangeDeepLink(deepLink);
    windowRef?.show();
    windowRef?.focus();
  });

  app.on("open-url", (event, url) => {
    event.preventDefault();
    void exchangeDeepLink(url);
  });

  app.whenReady().then(async () => {
    app.setAsDefaultProtocolClient("kryx");
    await loadState();
    installIpc();
    createWindow();
    await startBrowserRuntime();

    tray = new Tray(trayIcon());
    tray.on("click", () => {
      windowRef?.isVisible() ? windowRef.hide() : windowRef?.show();
    });
    rebuildTray();

    if (state.session?.deviceToken) {
      await loadAccount();
      startHeartbeat();
      startTaskPolling();
    } else {
      emitState();
    }

    const deepLink = process.argv.find((arg) => arg.startsWith("kryx://"));
    if (deepLink) void exchangeDeepLink(deepLink);
  });
}

app.on("before-quit", () => {
  quitting = true;
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  if (taskTimer) clearInterval(taskTimer);
  browserBridge?.close();
});
