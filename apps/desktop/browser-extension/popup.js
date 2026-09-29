const tokenInput = document.querySelector("#token");
const connection = document.querySelector("#connection");
const site = document.querySelector("#site");
const pairButton = document.querySelector("#pair");
const grantButton = document.querySelector("#grant");

function originPattern(rawUrl) {
  const url = new URL(rawUrl);
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  return `${url.origin}/*`;
}

async function refresh() {
  const stored = await chrome.storage.local.get(["pairingToken", "connectionState"]);
  tokenInput.value = stored.pairingToken || "";
  connection.textContent =
    stored.connectionState === "connected"
      ? "Connected to Kryx Desktop"
      : stored.pairingToken
        ? "Desktop bridge not connected"
        : "Not paired yet";

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const pattern = tab?.url ? originPattern(tab.url) : null;

  if (!pattern) {
    site.textContent = "This page cannot be automated.";
    grantButton.disabled = true;
    return;
  }

  const url = new URL(tab.url);
  const granted = await chrome.permissions.contains({ origins: [pattern] });
  site.textContent = granted
    ? `${url.origin} — allowed`
    : `${url.origin} — not allowed`;
  grantButton.textContent = granted ? "Site allowed" : "Allow this site";
  grantButton.disabled = granted;
}

pairButton.addEventListener("click", async () => {
  const token = tokenInput.value.trim();
  if (!token) return;
  await chrome.storage.local.set({ pairingToken: token, connectionState: "connecting" });
  connection.textContent = "Connecting…";
  setTimeout(() => void refresh(), 700);
});

grantButton.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const pattern = tab?.url ? originPattern(tab.url) : null;
  if (!pattern) return;

  const granted = await chrome.permissions.request({ origins: [pattern] });
  if (!granted) {
    site.textContent = "Site access was not granted.";
  }
  await refresh();
});

chrome.storage.onChanged.addListener(() => void refresh());
void refresh();
