import http from "node:http";
import { randomUUID } from "node:crypto";
import { WebSocketServer } from "ws";

const DEFAULT_PORT = 17891;
const CALL_TIMEOUT_MS = 20_000;

export class BrowserBridge {
  constructor({
    token,
    port = DEFAULT_PORT,
    onStatus = () => {},
    onObserverEvent = () => {},
  }) {
    this.token = token;
    this.port = port;
    this.onStatus = onStatus;
    this.onObserverEvent = onObserverEvent;
    this.httpServer = null;
    this.wsServer = null;
    this.socket = null;
    this.pending = new Map();
  }

  status() {
    return {
      connected: Boolean(this.socket && this.socket.readyState === 1),
      port: this.port,
    };
  }

  async start() {
    if (this.httpServer) return;

    this.httpServer = http.createServer((_request, response) => {
      response.writeHead(404, {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
      });
      response.end("Kryx browser bridge");
    });

    this.wsServer = new WebSocketServer({
      server: this.httpServer,
      path: "/kryx",
      verifyClient: ({ req }) => {
        try {
          const origin = req.headers.origin || "";
          if (!origin.startsWith("chrome-extension://")) return false;
          const url = new URL(req.url || "", `http://127.0.0.1:${this.port}`);
          return url.searchParams.get("token") === this.token;
        } catch {
          return false;
        }
      },
    });

    this.wsServer.on("connection", (socket) => {
      this.socket?.close(4001, "Replaced by a newer Kryx browser connection.");
      this.socket = socket;
      this.onStatus(this.status());

      socket.on("message", (raw) => this.handleMessage(raw));
      socket.on("close", () => {
        if (this.socket === socket) this.socket = null;
        this.onStatus(this.status());
      });
      socket.on("error", () => {
        if (this.socket === socket) this.socket = null;
        this.onStatus(this.status());
      });
    });

    await new Promise((resolve, reject) => {
      this.httpServer.once("error", reject);
      this.httpServer.listen(this.port, "127.0.0.1", resolve);
    });

    this.onStatus(this.status());
  }

  handleMessage(raw) {
    let message;
    try {
      message = JSON.parse(String(raw));
    } catch {
      return;
    }

    if (message?.type === "hello") {
      this.onStatus({ ...this.status(), browser: message.browser || null });
      return;
    }

    if (message?.type === "observer_event" && message.event) {
      this.onObserverEvent(message.event);
      return;
    }

    if (message?.type === "result" && message.id) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      clearTimeout(pending.timer);
      if (message.ok) pending.resolve(message.result);
      else pending.reject(new Error(message.error || "Browser command failed."));
    }
  }

  call(method, args = {}, timeoutMs = CALL_TIMEOUT_MS) {
    if (!this.socket || this.socket.readyState !== 1) {
      return Promise.reject(new Error("Kryx browser extension is not connected."));
    }

    const id = randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Browser command timed out: ${method}`));
      }, timeoutMs);

      this.pending.set(id, { resolve, reject, timer });
      this.socket.send(JSON.stringify({ type: "command", id, method, args }));
    });
  }

  close() {
    for (const { reject, timer } of this.pending.values()) {
      clearTimeout(timer);
      reject(new Error("Browser bridge closed."));
    }
    this.pending.clear();
    this.socket?.close();
    this.wsServer?.close();
    this.httpServer?.close();
    this.socket = null;
    this.wsServer = null;
    this.httpServer = null;
  }
}
