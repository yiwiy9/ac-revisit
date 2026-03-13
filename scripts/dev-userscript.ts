import { watch } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import * as http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildUserscript } from "./build-userscript.js";

const DEFAULT_PORT = 4310;
const DEFAULT_HOST = "127.0.0.1";
const DEV_USERSCRIPT_FILENAME = "ac-revisit.dev.user.js";

const workspaceRoot = path.dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const outputPath = path.join(workspaceRoot, "dist", DEV_USERSCRIPT_FILENAME);
const packageJsonPath = path.join(workspaceRoot, "package.json");
const watchRoots = ["src", "scripts"];

let activeBuild: Promise<void> = Promise.resolve();
let pendingBuild = false;
let rebuildTimer: NodeJS.Timeout | null = null;

const server = http.createServer(async (request, response) => {
  const requestPath = request.url ?? "/";

  if (requestPath === `/${DEV_USERSCRIPT_FILENAME}`) {
    try {
      const userscript = await readFile(outputPath, "utf8");
      response.writeHead(200, {
        "content-type": "text/javascript; charset=utf-8",
        "cache-control": "no-store",
      });
      response.end(userscript);
      return;
    } catch {
      response.writeHead(503, { "content-type": "text/plain; charset=utf-8" });
      response.end("userscript is not ready yet");
      return;
    }
  }

  response.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
  response.end(
    [
      `Tampermonkey install URL: http://${DEFAULT_HOST}:${port}/${DEV_USERSCRIPT_FILENAME}`,
      "Keep this process running while testing.",
    ].join("\n"),
  );
});

const port = normalizePort(process.env.PORT);
const watchDisposers: Array<() => void> = [];

await rebuild("startup");
await startWatchers();

server.listen(port, DEFAULT_HOST, () => {
  process.stdout.write(
    [
      `[dev-userscript] serving http://${DEFAULT_HOST}:${port}/${DEV_USERSCRIPT_FILENAME}`,
      "[dev-userscript] watching src/ and scripts/ for changes",
    ].join("\n") + "\n",
  );
});

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

async function rebuild(reason: string): Promise<void> {
  if (pendingBuild) {
    return activeBuild;
  }

  pendingBuild = true;
  activeBuild = activeBuild
    .catch(() => undefined)
    .then(async () => {
      pendingBuild = false;
      process.stdout.write(`[dev-userscript] rebuilding (${reason})\n`);
      const devVersion = createDevVersion();
      await buildUserscript({
        outputPath,
        userscriptName: "ac-revisit (dev)",
        userscriptVersion: devVersion,
        extraMetadata: [
          {
            key: "downloadURL",
            value: `http://${DEFAULT_HOST}:${port}/${DEV_USERSCRIPT_FILENAME}`,
          },
          {
            key: "updateURL",
            value: `http://${DEFAULT_HOST}:${port}/${DEV_USERSCRIPT_FILENAME}`,
          },
        ],
      });
      process.stdout.write(`[dev-userscript] build complete (version: ${devVersion})\n`);
    })
    .catch((error: unknown) => {
      process.stderr.write(`[dev-userscript] build failed: ${String(error)}\n`);
    });

  return activeBuild;
}

function createDevVersion(): string {
  return `0.0.0.${Math.floor(Date.now() / 1000)}`;
}

async function startWatchers(): Promise<void> {
  const directories = await collectWatchDirectories();

  for (const directory of directories) {
    const watcher = watch(directory, (_eventType, filename) => {
      if (filename !== null && !shouldTriggerRebuild(filename.toString())) {
        return;
      }

      scheduleRebuild(filename === null ? directory : path.join(directory, filename.toString()));
    });

    watchDisposers.push(() => watcher.close());
  }

  const packageWatcher = watch(packageJsonPath, () => {
    scheduleRebuild("package.json");
  });

  watchDisposers.push(() => packageWatcher.close());
}

async function collectWatchDirectories(): Promise<string[]> {
  const directories: string[] = [];

  for (const root of watchRoots) {
    const absoluteRoot = path.join(workspaceRoot, root);
    directories.push(absoluteRoot);
    directories.push(...(await collectNestedDirectories(absoluteRoot)));
  }

  return directories;
}

async function collectNestedDirectories(root: string): Promise<string[]> {
  const nestedDirectories: string[] = [];
  const entries = await readdir(root, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const absolutePath = path.join(root, entry.name);
    nestedDirectories.push(absolutePath);
    nestedDirectories.push(...(await collectNestedDirectories(absolutePath)));
  }

  return nestedDirectories;
}

function shouldTriggerRebuild(filename: string): boolean {
  return /\.(ts|js|json)$/.test(filename);
}

function scheduleRebuild(reason: string): void {
  if (rebuildTimer !== null) {
    clearTimeout(rebuildTimer);
  }

  rebuildTimer = setTimeout(() => {
    rebuildTimer = null;
    void rebuild(reason);
  }, 75);
}

function normalizePort(rawPort: string | undefined): number {
  if (rawPort === undefined) {
    return DEFAULT_PORT;
  }

  const numericPort = Number(rawPort);

  if (!Number.isInteger(numericPort) || numericPort <= 0 || numericPort > 65535) {
    throw new Error(`PORT must be an integer between 1 and 65535: ${rawPort}`);
  }

  return numericPort;
}

function shutdown(): void {
  for (const dispose of watchDisposers) {
    dispose();
  }

  server.close(() => {
    process.exit(0);
  });
}
