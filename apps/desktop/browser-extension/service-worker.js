let socket = null;
let reconnectTimer = null;
let keepAliveTimer = null;
let observerEnabled = false;
const BRIDGE_URL = "ws://127.0.0.1:17891/kryx";

async function pairingToken() {
  const { pairingToken } = await chrome.storage.local.get("pairingToken");
  return typeof pairingToken === "string" ? pairingToken : "";
}

function setConnectionState(state) {
  chrome.storage.local.set({
    connectionState: state,
    connectionUpdatedAt: Date.now(),
  });
}

function stopTimers() {
  if (keepAliveTimer) clearInterval(keepAliveTimer);
  if (reconnectTimer) clearTimeout(reconnectTimer);
  keepAliveTimer = null;
  reconnectTimer = null;
}

async function connect() {
  stopTimers();
  const token = await pairingToken();
  if (!token) {
    setConnectionState("unpaired");
    return;
  }

  try {
    socket = new WebSocket(`${BRIDGE_URL}?token=${encodeURIComponent(token)}`);
  } catch {
    scheduleReconnect();
    return;
  }

  socket.onopen = () => {
    setConnectionState("connected");
    socket.send(JSON.stringify({
      type: "hello",
      browser: {
        name: "Chrome",
        extensionVersion: chrome.runtime.getManifest().version,
      },
    }));
    keepAliveTimer = setInterval(() => {
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "keepalive", at: Date.now() }));
      }
    }, 20_000);
  };

  socket.onmessage = (event) => {
    void onBridgeMessage(event.data);
  };

  socket.onclose = () => {
    socket = null;
    setConnectionState("disconnected");
    scheduleReconnect();
  };

  socket.onerror = () => {
    setConnectionState("error");
  };
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    void connect();
  }, 2_500);
}

function sendResult(id, ok, payload) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify(
    ok
      ? { type: "result", id, ok: true, result: payload }
      : { type: "result", id, ok: false, error: String(payload || "Browser command failed.") },
  ));
}

async function onBridgeMessage(raw) {
  let message;
  try {
    message = JSON.parse(String(raw));
  } catch {
    return;
  }
  if (message?.type !== "command" || !message.id || !message.method) return;

  try {
    const result = await dispatch(message.method, message.args || {});
    sendResult(message.id, true, result);
  } catch (error) {
    sendResult(message.id, false, error instanceof Error ? error.message : String(error));
  }
}

function requireHttpUrl(raw) {
  const url = new URL(raw);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Kryx only automates http/https pages through the browser bridge.");
  }
  return url;
}

async function tabById(tabId) {
  const tab = await chrome.tabs.get(Number(tabId));
  if (!tab?.id || !tab.url) throw new Error("Browser tab not found.");
  requireHttpUrl(tab.url);
  return tab;
}

async function assertOriginGranted(tab) {
  const url = requireHttpUrl(tab.url);
  const originPattern = `${url.origin}/*`;
  const allowed = await chrome.permissions.contains({ origins: [originPattern] });
  if (!allowed) {
    throw new Error(`Browser access is not granted for ${url.origin}. Open the Kryx extension on that site and choose “Allow this site”.`);
  }
}

async function execute(tab, func, args = []) {
  await assertOriginGranted(tab);
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func,
    args,
    world: "ISOLATED",
  });
  return result;
}

function pageSnapshot() {
  const MAX_TEXT = 30_000;
  const MAX_ELEMENTS = 250;
  const selector = [
    "a[href]",
    "button",
    "input",
    "textarea",
    "select",
    "[role='button']",
    "[role='link']",
    "[contenteditable='true']",
  ].join(",");

  function visible(element) {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return (
      style.visibility !== "hidden" &&
      style.display !== "none" &&
      Number(style.opacity || "1") > 0 &&
      rect.width > 0 &&
      rect.height > 0
    );
  }

  let nextId = 1;
  const interactive = [];
  for (const element of document.querySelectorAll(selector)) {
    if (interactive.length >= MAX_ELEMENTS || !visible(element)) continue;

    const inputType = element instanceof HTMLInputElement
      ? (element.type || "text").toLowerCase()
      : null;
    if (inputType === "password") continue;

    let id = element.getAttribute("data-kryx-id");
    if (!id) {
      id = `kx-${Date.now().toString(36)}-${nextId++}`;
      element.setAttribute("data-kryx-id", id);
    }

    const rect = element.getBoundingClientRect();
    const label =
      element.getAttribute("aria-label") ||
      element.getAttribute("title") ||
      (element.labels?.[0]?.innerText ?? "") ||
      "";

    interactive.push({
      id,
      tag: element.tagName.toLowerCase(),
      role: element.getAttribute("role"),
      label: String(label).trim().slice(0, 300),
      text: String(element.innerText || element.textContent || "").trim().slice(0, 500),
      inputType,
      value:
        element instanceof HTMLInputElement ||
        element instanceof HTMLTextAreaElement ||
        element instanceof HTMLSelectElement
          ? String(element.value || "").slice(0, 1000)
          : null,
      href: element instanceof HTMLAnchorElement ? element.href : null,
      rect: {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
    });
  }

  return {
    sourceTrust: "untrusted_external_content",
    url: location.href,
    title: document.title,
    text: String(document.body?.innerText || "").slice(0, MAX_TEXT),
    interactive,
  };
}

function clickElement(elementId) {
  const element = document.querySelector(`[data-kryx-id="${elementId}"]`);
  if (!element) throw new Error("Element changed or disappeared. Re-read the page.");
  if (element instanceof HTMLInputElement && element.type.toLowerCase() === "password") {
    throw new Error("Kryx will not interact with password fields.");
  }
  element.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
  element.click();
  return { clicked: true, url: location.href };
}

function typeIntoElement(elementId, text, replace) {
  const element = document.querySelector(`[data-kryx-id="${elementId}"]`);
  if (!element) throw new Error("Element changed or disappeared. Re-read the page.");
  if (element instanceof HTMLInputElement && element.type.toLowerCase() === "password") {
    throw new Error("Kryx will not type into password fields.");
  }

  element.focus();

  if (element instanceof HTMLInputElement) {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
    const next = replace ? text : `${element.value}${text}`;
    descriptor?.set?.call(element, next);
  } else if (element instanceof HTMLTextAreaElement) {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value");
    const next = replace ? text : `${element.value}${text}`;
    descriptor?.set?.call(element, next);
  } else if (element instanceof HTMLSelectElement) {
    element.value = text;
  } else if (element.isContentEditable) {
    element.textContent = replace ? text : `${element.textContent || ""}${text}`;
  } else {
    throw new Error("This element is not an editable control.");
  }

  element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
  return { typed: true };
}

function scrollPage(deltaX, deltaY) {
  window.scrollBy({ left: deltaX || 0, top: deltaY || 0, behavior: "instant" });
  return { x: window.scrollX, y: window.scrollY };
}

async function emitObserverEvent(tab, eventType) {
  if (!observerEnabled || !tab?.id || !tab?.url) return;

  let url;
  try {
    url = requireHttpUrl(tab.url);
  } catch {
    return;
  }

  const originPattern = `${url.origin}/*`;
  const allowed = await chrome.permissions.contains({ origins: [originPattern] });
  if (!allowed) return;

  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify({
    type: "observer_event",
    event: {
      observedAt: new Date().toISOString(),
      appId: "com.google.Chrome",
      windowClass: "browser_tab",
      eventType,
      domain: url.hostname.toLowerCase(),
      elementRole: "tab"
    }
  }));
}

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId);
    await emitObserverEvent(tab, "tab_activated");
  } catch {}
});

chrome.tabs.onUpdated.addListener(async (_tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" || changeInfo.url) {
    await emitObserverEvent(tab, "navigation");
  }
});

async function dispatch(method, args) {
  switch (method) {
    case "observer.set": {
      observerEnabled = Boolean(args.enabled);
      return { enabled: observerEnabled };
    }

    case "tabs.list": {
      const tabs = await chrome.tabs.query({});
      return tabs
        .filter((tab) => tab.id && tab.url && /^https?:/.test(tab.url))
        .map((tab) => ({
          id: tab.id,
          title: tab.title || "",
          url: tab.url,
          active: Boolean(tab.active),
          windowId: tab.windowId,
        }));
    }

    case "tabs.open": {
      const url = requireHttpUrl(args.url).toString();
      const tab = await chrome.tabs.create({ url, active: args.active !== false });
      return { id: tab.id, url: tab.url || url };
    }

    case "tabs.activate": {
      const tab = await tabById(args.tabId);
      await chrome.tabs.update(tab.id, { active: true });
      await chrome.windows.update(tab.windowId, { focused: true });
      return { id: tab.id, active: true };
    }

    case "tabs.close": {
      const tab = await tabById(args.tabId);
      await chrome.tabs.remove(tab.id);
      return { closed: true };
    }

    case "page.read": {
      const tab = await tabById(args.tabId);
      return execute(tab, pageSnapshot);
    }

    case "page.click": {
      const tab = await tabById(args.tabId);
      return execute(tab, clickElement, [String(args.elementId)]);
    }

    case "page.type": {
      const tab = await tabById(args.tabId);
      return execute(tab, typeIntoElement, [
        String(args.elementId),
        String(args.text ?? ""),
        args.replace !== false,
      ]);
    }

    case "page.scroll": {
      const tab = await tabById(args.tabId);
      return execute(tab, scrollPage, [
        Number(args.deltaX || 0),
        Number(args.deltaY || 0),
      ]);
    }

    default:
      throw new Error(`Unknown Kryx browser command: ${method}`);
  }
}

chrome.runtime.onInstalled.addListener(() => void connect());
chrome.runtime.onStartup.addListener(() => void connect());
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.pairingToken) void connect();
});
void connect();
