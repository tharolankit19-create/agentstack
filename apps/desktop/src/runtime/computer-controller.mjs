import { spawn } from "node:child_process";
import path from "node:path";
import { app } from "electron";

function archDir() {
  if (process.arch === "arm64") return "arm64";
  if (process.arch === "x64") return "amd64";
  throw new Error(`Unsupported architecture: ${process.arch}`);
}

function packageRoot() {
  if (app.isPackaged) {
    return path.join(
      process.resourcesPath,
      "app.asar.unpacked",
      "node_modules",
      "@opensymph",
      "open-computer-use",
    );
  }
  return path.join(app.getAppPath(), "node_modules", "@opensymph", "open-computer-use");
}

export function openComputerUseBinary() {
  const root = packageRoot();
  if (process.platform === "darwin") {
    return path.join(
      root,
      "dist",
      "Open Computer Use.app",
      "Contents",
      "MacOS",
      "OpenComputerUse",
    );
  }
  if (process.platform === "win32") {
    return path.join(root, "dist", "windows", archDir(), "open-computer-use.exe");
  }
  if (process.platform === "linux") {
    return path.join(root, "dist", "linux", archDir(), "open-computer-use");
  }
  throw new Error(`Unsupported platform: ${process.platform}`);
}

function parseOutput(stdout) {
  const trimmed = stdout.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    const lines = trimmed.split(/\r?\n/).filter(Boolean);
    for (let index = lines.length - 1; index >= 0; index -= 1) {
      try { return JSON.parse(lines[index]); } catch {}
    }
    return { raw: trimmed };
  }
}

export class ComputerController {
  constructor({ allowForeground = false } = {}) {
    this.allowForeground = allowForeground;
  }

  run(args, { timeoutMs = 25_000 } = {}) {
    return new Promise((resolve, reject) => {
      const executable = openComputerUseBinary();
      const env = { ...process.env };

      if (this.allowForeground) {
        if (process.platform === "darwin") {
          env.OPEN_COMPUTER_USE_MACOS_ALLOW_FOREGROUND_INPUT = "1";
        } else if (process.platform === "win32") {
          env.OPEN_COMPUTER_USE_WINDOWS_ALLOW_FOREGROUND_INPUT = "1";
        } else if (process.platform === "linux") {
          env.OPEN_COMPUTER_USE_ALLOW_GLOBAL_POINTER_FALLBACKS = "1";
        }
      }

      const child = spawn(executable, args, {
        env,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });

      let stdout = "";
      let stderr = "";
      const timer = setTimeout(() => {
        child.kill("SIGTERM");
        reject(new Error(`Computer action timed out: ${args.join(" ")}`));
      }, timeoutMs);

      child.stdout.on("data", (chunk) => {
        stdout += chunk;
        if (stdout.length > 2_000_000) child.kill("SIGTERM");
      });
      child.stderr.on("data", (chunk) => {
        stderr += chunk;
        if (stderr.length > 200_000) child.kill("SIGTERM");
      });
      child.on("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        if (code !== 0) {
          reject(new Error(stderr.trim() || `Open Computer Use exited with ${code}`));
          return;
        }
        resolve(parseOutput(stdout));
      });
    });
  }

  version() {
    return this.run(["--version"], { timeoutMs: 5_000 });
  }

  call(tool, args = {}) {
    return this.run(["call", tool, "--args", JSON.stringify(args)]);
  }

  openApp(appName) {
    if (process.platform !== "darwin") {
      throw new Error("Native app launching is only wired for macOS in Kryx v1.2.");
    }

    return new Promise((resolve, reject) => {
      const child = spawn("/usr/bin/open", ["-a", String(appName)], {
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stderr = "";
      const timer = setTimeout(() => {
        child.kill("SIGTERM");
        reject(new Error("Opening the app timed out."));
      }, 8_000);

      child.stderr.on("data", (chunk) => {
        stderr += chunk;
      });
      child.on("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        if (code !== 0) {
          reject(new Error(stderr.trim() || `Could not open ${appName}.`));
          return;
        }
        resolve({ ok: true, app: appName });
      });
    });
  }

  listApps() {
    return this.call("list_apps");
  }

  getAppState(appName) {
    return this.call("get_app_state", { app: appName });
  }

  click(args) {
    return this.call("click", args);
  }

  typeText(args) {
    return this.call("type_text", args);
  }

  pressKey(args) {
    return this.call("press_key", args);
  }

  scroll(args) {
    return this.call("scroll", args);
  }

  setValue(args) {
    return this.call("set_value", args);
  }
}
