import { copyFileSync, existsSync, mkdirSync, watch } from "node:fs";
import { spawn } from "node:child_process";
import esbuild from "esbuild";

const distDir = "dist";
const templateSrc = "src/template.html";
const templateDest = `${distDir}/template.html`;
const watchFile = "example.md";
const port = 3000;
const requiredOutputs = [
  `${distDir}/cli.js`,
  `${distDir}/cmd_watch.js`,
  `${distDir}/markdown_process.js`,
  `${distDir}/style.css`,
  templateDest,
];

let serverProcess = null;
let restartTimer = null;
let shuttingDown = false;
let cssReady = false;
let tsReady = false;
let templateReady = false;
let suppressExitRestart = false;
let restartInFlight = false;

const log = (message) => {
  console.log(`[dev] ${message}`);
};

mkdirSync(distDir, { recursive: true });
copyTemplate();

const ctx = await esbuild.context({
  entryPoints: ["src/style.css"],
  bundle: true,
  sourcemap: true,
  outdir: distDir,
  plugins: [
    {
      name: "dev-restart",
      setup(build) {
        build.onEnd((result) => {
          if (!cssReady) {
            cssReady = true;
            maybeStartServer();
            return;
          }
          if (result.errors.length === 0) {
            scheduleRestart("css");
          }
        });
      },
    },
  ],
});

await ctx.watch();

const tscBin = process.platform === "win32" ? "node_modules/.bin/tsc.cmd" : "node_modules/.bin/tsc";
const tsc = spawn(
  tscBin,
  ["-p", "tsconfig.json", "--watch", "--preserveWatchOutput", "--pretty", "false"],
  { stdio: ["ignore", "pipe", "pipe"] },
);

tsc.on("error", (error) => {
  console.error("[dev] Failed to start tsc:", error);
  void shutdown("tsc-error");
});

let tscBuffer = "";
tsc.stdout.setEncoding("utf8");
tsc.stdout.on("data", (chunk) => {
  process.stdout.write(chunk);
  tscBuffer += chunk;
  const lines = tscBuffer.split(/\r?\n/);
  tscBuffer = lines.pop() ?? "";
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    if (/Found \d+ errors?/i.test(trimmed)) {
      if (!tsReady) {
        tsReady = true;
        maybeStartServer();
      } else {
        scheduleRestart("tsc");
      }
    }
  }
});

tsc.stderr.setEncoding("utf8");
tsc.stderr.on("data", (chunk) => {
  process.stderr.write(chunk);
});

const templateWatcher = watch(templateSrc, () => {
  copyTemplate();
  scheduleRestart("template");
});

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

function maybeStartServer() {
  if (shuttingDown || serverProcess) {
    return;
  }
  if (!cssReady || !tsReady || !templateReady) {
    return;
  }
  if (!distReady()) {
    log("Waiting for build output...");
    return;
  }
  startServer();
}

function startServer() {
  if (serverProcess) {
    return;
  }
  log("Starting watch server...");
  serverProcess = spawn("node", ["dist/cli.js", "watch", watchFile, "-p", String(port)], {
    stdio: "inherit",
  });
  serverProcess.on("exit", (code, signal) => {
    serverProcess = null;
    if (suppressExitRestart) {
      suppressExitRestart = false;
      return;
    }
    if (!shuttingDown) {
      log(`Watch server exited (${signal ?? code}).`);
      scheduleRestart("exit");
    }
  });
}

async function stopServer() {
  if (!serverProcess) {
    return;
  }

  const proc = serverProcess;
  serverProcess = null;
  suppressExitRestart = true;

  await new Promise((resolve) => {
    const killTimer = setTimeout(() => {
      proc.kill("SIGKILL");
      resolve();
    }, 2000);

    proc.once("exit", () => {
      clearTimeout(killTimer);
      resolve();
    });

    proc.kill("SIGTERM");
  });
}

function scheduleRestart(reason) {
  if (shuttingDown) {
    return;
  }
  if (restartTimer) {
    clearTimeout(restartTimer);
  }
  restartTimer = setTimeout(() => {
    void restartServer(reason);
  }, 200);
}

async function restartServer(reason) {
  if (shuttingDown) {
    return;
  }
  if (restartInFlight) {
    return;
  }
  restartInFlight = true;
  if (!cssReady || !tsReady || !templateReady) {
    restartInFlight = false;
    return;
  }
  if (!distReady()) {
    log("Skipping restart; build output missing.");
    restartInFlight = false;
    return;
  }
  log(`Restarting watch server (${reason})...`);
  await stopServer();
  startServer();
  restartInFlight = false;
}

async function shutdown(signal) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  log(`Shutting down (${signal})...`);
  templateWatcher.close();
  await ctx.dispose();
  tsc.kill("SIGTERM");
  await stopServer();
  process.exit(0);
}

function copyTemplate() {
  try {
    copyFileSync(templateSrc, templateDest);
    templateReady = true;
    maybeStartServer();
  } catch (error) {
    console.error("[dev] Failed to copy template.html", error);
  }
}

function distReady() {
  return requiredOutputs.every((filePath) => existsSync(filePath));
}
