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
    const name = String(appName || "").trim();
    if (!name) throw new Error("App name is required.");

    let executable;
    let args;
    let env = { ...process.env };

    if (process.platform === "darwin") {
      executable = "/usr/bin/open";
      args = ["-a", name];
    } else if (process.platform === "win32") {
      executable = "powershell.exe";
      env.KRYX_APP_NAME = name;
      args = [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        [
          "$n=$env:KRYX_APP_NAME;",
          "$roots=@(",
          "  (Join-Path $env:ProgramData 'Microsoft\\Windows\\Start Menu\\Programs'),",
          "  (Join-Path $env:APPDATA 'Microsoft\\Windows\\Start Menu\\Programs')",
          ");",
          "$lnk=Get-ChildItem $roots -Filter *.lnk -Recurse -ErrorAction SilentlyContinue |",
          "  Where-Object { $_.BaseName -ieq $n -or $_.BaseName -like ('*'+$n+'*') } |",
          "  Select-Object -First 1;",
          "if($lnk){Start-Process $lnk.FullName}else{Start-Process $n}",
        ].join(" "),
      ];
    } else if (process.platform === "linux") {
      executable = "/bin/sh";
      env.KRYX_APP_NAME = name;
      args = [
        "-lc",
        [
          "name=\"$KRYX_APP_NAME\";",
          "for dir in \"$HOME/.local/share/applications\" /usr/local/share/applications /usr/share/applications; do",
          "  [ -d \"$dir\" ] || continue;",
          "  file=$(grep -rilm1 --include='*.desktop' -E \"^Name=$name$\" \"$dir\" 2>/dev/null | head -n1);",
          "  if [ -n \"$file\" ]; then",
          "    desktop=$(basename \"$file\" .desktop);",
          "    if command -v gtk-launch >/dev/null 2>&1; then gtk-launch \"$desktop\" >/dev/null 2>&1 & exit 0; fi;",
          "    if command -v gio >/dev/null 2>&1; then gio launch \"$file\" >/dev/null 2>&1 & exit 0; fi;",
          "  fi;",
          "done;",
          "if command -v \"$name\" >/dev/null 2>&1; then \"$name\" >/dev/null 2>&1 & exit 0; fi;",
          "exit 127",
        ].join(" "),
      ];
    } else {
      throw new Error(`Unsupported platform: ${process.platform}`);
    }

    return new Promise((resolve, reject) => {
      const child = spawn(executable, args, {
        env,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });

      let stderr = "";
      const timer = setTimeout(() => {
        child.kill("SIGTERM");
        reject(new Error("Opening the app timed out."));
      }, 10_000);

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
          reject(new Error(stderr.trim() || `Could not open ${name}.`));
          return;
        }
        resolve({ ok: true, app: name });
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
