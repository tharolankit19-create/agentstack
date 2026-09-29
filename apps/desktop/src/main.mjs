import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  nativeImage,
  Notification,
  safeStorage,
  shell,
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_BASE = (process.env.KRYX_API_URL || "https://getkryxai.com").replace(/\/+$/, "");
const HEARTBEAT_MS = 30_000;
const REFRESH_EARLY_MS = 2 * 60 * 1000;

let windowRef = null;
let tray = null;
let heartbeatTimer = null;
let quitting = false;
let state = {
  installationId: null,
  publicKey: null,
  privateKey: null,
  pendingAuth: null,
  session: null,
  account: null,
  agents: [],
  error: null,
};

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
    throw new Error("Secure storage is unavailable on this Mac.");
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
      deviceName: os.hostname() || "Mac",
      platform: process.platform === "darwin" ? "macos" : process.platform,
      osVersion: os.release(),
      appVersion: app.getVersion(),
      state: loginState,
      codeChallenge: challengeFor(codeVerifier),
      redirectUri: "kryx://auth/callback",
      publicKey: state.publicKey,
      capabilities: {
        menuBar: true,
        notifications: true,
        localRuntime: true,
        browserControl: false,
        accessibilityControl: false
      },
      permissions: {}
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
    state.pendingAuth = null;
    state.error = null;
    await saveState();
    await loadAccount();
    startHeartbeat();

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
          menuBar: true,
          notifications: true,
          localRuntime: true,
          browserControl: false,
          accessibilityControl: false
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
  state.error = null;
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = null;
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
      { label: "Open Kryx", click: () => { windowRef?.show(); windowRef?.focus(); } },
      { label: "Open Web App", click: () => void shell.openExternal(`${API_BASE}/dashboard`) },
      ...(connected ? [{ label: "Disconnect this Mac", click: () => void signOut() }] : []),
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

    tray = new Tray(trayIcon());
    tray.on("click", () => {
      windowRef?.isVisible() ? windowRef.hide() : windowRef?.show();
    });
    rebuildTray();

    if (state.session?.deviceToken) {
      await loadAccount();
      startHeartbeat();
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
});
