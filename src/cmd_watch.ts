import { readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname } from "node:path";
import chokidar from "chokidar";
import commandLineArgs from "command-line-args";
import { processMarkdown } from "./markdown_process.js";

const usage = "Usage: scimd watch <file.md> [-p <port>]";
const defaultPort = 3000;

type WatchOptions = {
  input?: string;
  port?: number;
};

type WatchState = {
  clients: Set<import("node:http").ServerResponse>;
  reloadTimer: NodeJS.Timeout | null;
};

const reloadScript = `<script>
  const events = new EventSource("/events");
  events.onmessage = () => window.location.reload();
</script>`;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function runWatch(argv: string[]): void {
  let filePath: string | undefined;
  let port = defaultPort;

  try {
    const watchDefinitions = [
      { name: "input", defaultOption: true },
      { name: "port", alias: "p", type: Number },
    ];
    const watchOptions = commandLineArgs(watchDefinitions, { argv }) as WatchOptions;

    filePath = watchOptions.input;
    if (typeof watchOptions.port === "number") {
      port = watchOptions.port;
    }
  } catch {
    console.error(usage);
    process.exit(1);
  }

  if (!filePath) {
    console.error(usage);
    process.exit(1);
  }

  if (extname(filePath) !== ".md") {
    console.error("File must have a .md extension.");
    process.exit(1);
  }

  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    console.error("Port must be a valid integer between 1 and 65535.");
    process.exit(1);
  }

  try {
    const stats = statSync(filePath);
    if (!stats.isFile()) {
      console.error("Path must be a file.");
      process.exit(1);
    }
  } catch {
    console.error("File does not exist.");
    process.exit(1);
  }

  const templateUrl = new URL("./template.html", import.meta.url);
  const templateHtml = readFileSync(templateUrl, "utf8");
  const styleUrl = new URL("./style.css", import.meta.url);
  const styleCss = readFileSync(styleUrl);

  const state: WatchState = { clients: new Set(), reloadTimer: null };

  const server = createServer((req, res) => {
    const url = req.url ?? "/";

    if (url === "/" || url.startsWith("/?")) {
      const responseHtml = buildHtml(filePath, templateHtml);
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(responseHtml);
      return;
    }

    if (url === "/style.css") {
      res.writeHead(200, { "Content-Type": "text/css; charset=utf-8" });
      res.end(styleCss);
      return;
    }

    if (url === "/events") {
      // SSE stream to tell the browser to reload on file changes.
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      res.write("retry: 250\n\n");
      state.clients.add(res);
      req.on("close", () => {
        state.clients.delete(res);
      });
      return;
    }

    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  });

  server.on("error", (error) => {
    console.error("Server error:", error);
    process.exit(1);
  });

  server.listen(port, "127.0.0.1", () => {
    console.log(`Watching ${filePath}`);
    console.log(`Server running at http://127.0.0.1:${port}/`);
  });

  const notifyReload = () => {
    if (state.reloadTimer) {
      clearTimeout(state.reloadTimer);
    }

    state.reloadTimer = setTimeout(() => {
      for (const client of state.clients) {
        client.write("data: reload\n\n");
      }
    }, 50);
  };

  // Watch the markdown file and trigger SSE reloads.
  const watcher = chokidar.watch(filePath, {
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 100,
      pollInterval: 50,
    },
  });

  watcher.on("change", notifyReload);
  watcher.on("add", notifyReload);
  watcher.on("unlink", notifyReload);
  watcher.on("error", (error) => {
    console.error("Watcher error:", error);
  });

  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    void watcher.close();
    if (state.reloadTimer) {
      clearTimeout(state.reloadTimer);
    }
    for (const client of state.clients) {
      client.end();
    }
    server.close(() => {
      console.log(`Stopped watch server (${signal}).`);
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 1000);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

function buildHtml(filePath: string, templateHtml: string): string {
  try {
    const markdown = readFileSync(filePath, "utf8");
    const result = processMarkdown(markdown, { throwOnError: false });
    const errorBlock = result.errors.length > 0 ? formatDocumentErrors(result.errors) : "";
    const bodyClass = result.numberedHeadings ? " numbered-headings" : "";
    console.log(`Rendered ${filePath} at ${new Date().toLocaleTimeString()}`);
    return templateHtml
      .replace("{{TITLE}}", escapeHtml(result.title))
      .replace("{{BODY_CLASS}}", bodyClass)
      .replace("{{CONTENT}}", `${errorBlock}${result.html}\n${reloadScript}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const errorHtml = `<pre class="scimd-error">${escapeHtml(message)}</pre>`;
    return templateHtml
      .replace("{{TITLE}}", "scimd")
      .replace("{{BODY_CLASS}}", "")
      .replace("{{CONTENT}}", `${errorHtml}\n${reloadScript}`);
  }
}

function formatDocumentErrors(errors: string[]): string {
  const message = ["Document errors:", ...errors.map((error) => `- ${error}`)].join("\n");
  return `<pre class="scimd-error">${escapeHtml(message)}</pre>`;
}
