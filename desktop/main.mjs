import { app, BrowserWindow, dialog, shell } from "electron";
import { spawn, execSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PORT = Number(process.env.PORT || 3000);
const APP_URL = `http://127.0.0.1:${PORT}`;
const LOG_FILE = path.join(ROOT, "launcher", "desktop.log");

/** @type {import('node:child_process').ChildProcess | null} */
let server = null;
/** @type {BrowserWindow | null} */
let mainWindow = null;
let quitting = false;
/** @type {number | null} */
let serverExitCode = null;

function ensureLogDir() {
  fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
}

function log(message) {
  const line = `[id-assist-desktop] ${message}`;
  console.log(line);
  try {
    ensureLogDir();
    fs.appendFileSync(LOG_FILE, `${new Date().toISOString()} ${line}\n`);
  } catch {
    // ignore
  }
}

function portFree(port) {
  return new Promise((resolve) => {
    const tester = net
      .createServer()
      .once("error", () => resolve(false))
      .once("listening", () => {
        tester.close(() => resolve(true));
      })
      .listen(port, "127.0.0.1");
  });
}

async function clearPort(port) {
  if (await portFree(port)) return;
  log(`Port ${port} busy — attempting to free it`);
  try {
    const out = execSync(`lsof -tiTCP:${port} -sTCP:LISTEN`, {
      encoding: "utf8",
    }).trim();
    for (const pid of out.split(/\s+/).filter(Boolean)) {
      try {
        process.kill(Number(pid), "SIGTERM");
        log(`Sent SIGTERM to pid ${pid}`);
      } catch {
        // ignore
      }
    }
  } catch {
    // nothing listening
  }
  await new Promise((r) => setTimeout(r, 700));
}

function waitForServer(url, timeoutMs = 120000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      if (serverExitCode !== null) {
        reject(
          new Error(
            `Server process exited early (code ${serverExitCode}). See launcher/desktop.log`,
          ),
        );
        return;
      }
      const req = http.get(url, (res) => {
        res.resume();
        resolve(true);
      });
      req.on("error", () => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Timed out waiting for ${url}`));
          return;
        }
        setTimeout(tryOnce, 400);
      });
    };
    tryOnce();
  });
}

function nextBin() {
  const local = path.join(ROOT, "node_modules", "next", "dist", "bin", "next");
  if (fs.existsSync(local)) return local;
  throw new Error(`Next.js binary not found at ${local}. Run npm install.`);
}

function resolveNode() {
  const candidates = [
    process.env.NODE_BINARY,
    "/usr/local/bin/node",
    "/opt/homebrew/bin/node",
    "/usr/bin/node",
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) return candidate;
  }

  try {
    const which = execSync("command -v node", {
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `/usr/local/bin:/opt/homebrew/bin:${process.env.PATH || ""}`,
      },
    }).trim();
    if (which && fs.existsSync(which)) return which;
  } catch {
    // fall through
  }

  throw new Error(
    "Could not find node on PATH. Install Node.js or set NODE_BINARY.",
  );
}

function startNextServer() {
  serverExitCode = null;
  const env = {
    ...process.env,
    PATH: `/usr/local/bin:/opt/homebrew/bin:${process.env.PATH || ""}`,
    PORT: String(PORT),
    BROWSER: "none",
    FORCE_COLOR: "0",
  };

  // Always use next dev in the desktop shell — survives project moves and
  // avoids stale production builds exiting under Electron.
  const bin = nextBin();
  const nodeCmd = resolveNode();
  const args = [bin, "dev", "-p", String(PORT), "-H", "127.0.0.1"];
  log(`Starting: ${nodeCmd} ${args.join(" ")}`);
  log(`ROOT=${ROOT}`);

  server = spawn(nodeCmd, args, {
    cwd: ROOT,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
  });

  server.stdout?.on("data", (chunk) => {
    const text = String(chunk).trim();
    if (text) log(text);
  });
  server.stderr?.on("data", (chunk) => {
    const text = String(chunk).trim();
    if (text) log(text);
  });
  server.on("error", (err) => {
    log(`Server spawn error: ${err.message}`);
    serverExitCode = -1;
  });
  server.on("exit", (code, signal) => {
    serverExitCode = code ?? (signal ? 1 : 0);
    log(`Next.js exited code=${code} signal=${signal}`);
    server = null;
    if (!quitting) {
      dialog.showErrorBox(
        "ID Assist",
        `The local server stopped unexpectedly (code ${serverExitCode}).\n\nSee:\n${LOG_FILE}`,
      );
      app.quit();
    }
  });
}

function stopNextServer() {
  if (!server || !server.pid) {
    server = null;
    return;
  }
  log(`Stopping Next.js pid=${server.pid}…`);
  const pid = server.pid;
  try {
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", String(pid), "/f", "/t"]);
    } else {
      process.kill(pid, "SIGTERM");
    }
  } catch (err) {
    log(`Stop error: ${err instanceof Error ? err.message : String(err)}`);
  }
  server = null;
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 640,
    title: "ID Assist",
    backgroundColor: "#f4f6f8",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    show: false,
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (
      url.startsWith(APP_URL) ||
      url.startsWith("http://127.0.0.1") ||
      url.startsWith("http://localhost")
    ) {
      return { action: "allow" };
    }
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  await mainWindow.loadURL(APP_URL);
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    try {
      ensureLogDir();
      fs.writeFileSync(LOG_FILE, "");
      log("Desktop app starting");
      await clearPort(PORT);
      startNextServer();
      log(`Waiting for ${APP_URL}…`);
      await waitForServer(APP_URL);
      await createWindow();
      log("Window ready");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log(`Startup failure: ${message}`);
      dialog.showErrorBox(
        "ID Assist failed to start",
        `${message}\n\nSee:\n${LOG_FILE}`,
      );
      stopNextServer();
      app.quit();
    }
  });

  app.on("window-all-closed", () => {
    quitting = true;
    stopNextServer();
    app.quit();
  });

  app.on("before-quit", () => {
    quitting = true;
    stopNextServer();
  });
}
