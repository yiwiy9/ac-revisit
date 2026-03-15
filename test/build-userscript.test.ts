// @vitest-environment node
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test } from "vitest";

import { buildUserscript } from "../scripts/build-userscript.ts";

test("package.json exposes the canonical build script for the userscript bundle", async () => {
  const packageJsonPath = new URL("../package.json", import.meta.url);
  const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));

  expect(packageJson.scripts.build).toBe("npm run verify && tsx scripts/build-userscript.ts");
  expect(packageJson.scripts.dev).toBe("tsx scripts/dev-userscript.ts");
});

test("buildUserscript emits a single userscript bundle with required metadata", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "ac-revisit-build-"));

  try {
    const outputPath = path.join(tempDir, "ac-revisit.user.js");

    await buildUserscript({
      packageJsonPath: new URL("../package.json", import.meta.url),
      outputPath: pathToFileURL(outputPath),
    });

    const output = await readFile(outputPath, "utf8");

    expect(output).toMatch(/^\/\/ ==UserScript==/m);
    expect(output).toMatch(/^\/\/ @name\s+ac-revisit$/m);
    expect(output).toMatch(/^\/\/ @namespace\s+https:\/\/github\.com\/yiwiy9\/ac-revisit$/m);
    expect(output).toMatch(/^\/\/ @homepageURL\s+https:\/\/github\.com\/yiwiy9\/ac-revisit$/m);
    expect(output).toMatch(/^\/\/ @author\s+yiwiy9$/m);
    expect(output).toMatch(/^\/\/ @license\s+MIT$/m);
    expect(output).toMatch(/^\/\/ @version\s+0\.0\.0$/m);
    expect(output).toMatch(
      /^\/\/ @description\s+AtCoder で復習したい問題を静かに提案する userscript$/m,
    );
    expect(output).toMatch(/^\/\/ @match\s+https:\/\/atcoder\.jp\/\*$/m);
    expect(output).toMatch(/^\/\/ @grant\s+GM_getValue$/m);
    expect(output).toMatch(/^\/\/ @grant\s+GM_setValue$/m);
    expect(output).toMatch(/^\/\/ @run-at\s+document-end$/m);
    expect(output).toMatch(/^\/\/ ==\/UserScript==/m);
    expect(output).toMatch(/\(\(\) => \{/);
    expect(output).toMatch(/ac-revisit 操作/);
    expect(output).not.toMatch(/@require/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("buildUserscript fails when required metadata inputs are missing", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "ac-revisit-build-"));

  try {
    const packageJsonPath = path.join(tempDir, "package.json");

    await writeFile(
      packageJsonPath,
      JSON.stringify({
        name: "ac-revisit",
      }),
      "utf8",
    );

    await expect(
      buildUserscript({
        packageJsonPath: pathToFileURL(packageJsonPath),
        outputPath: pathToFileURL(path.join(tempDir, "ac-revisit.user.js")),
      }),
    ).rejects.toThrow(/Missing required package metadata: version/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("buildUserscript fails when package name drifts from the published userscript name", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "ac-revisit-build-"));

  try {
    const packageJsonPath = path.join(tempDir, "package.json");

    await writeFile(
      packageJsonPath,
      JSON.stringify({
        name: "different-name",
        version: "1.2.3",
      }),
      "utf8",
    );

    await expect(
      buildUserscript({
        packageJsonPath: pathToFileURL(packageJsonPath),
        outputPath: pathToFileURL(path.join(tempDir, "ac-revisit.user.js")),
      }),
    ).rejects.toThrow(/Published userscript name must remain ac-revisit/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("buildUserscript can emit development metadata for local Tampermonkey updates", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "ac-revisit-build-"));

  try {
    const outputPath = path.join(tempDir, "ac-revisit.dev.user.js");

    await buildUserscript({
      packageJsonPath: new URL("../package.json", import.meta.url),
      outputPath: pathToFileURL(outputPath),
      userscriptName: "ac-revisit (dev)",
      userscriptVersion: "0.0.0.1700000000",
      extraMetadata: [
        {
          key: "downloadURL",
          value: "http://127.0.0.1:4310/ac-revisit.dev.user.js",
        },
        {
          key: "updateURL",
          value: "http://127.0.0.1:4310/ac-revisit.dev.user.js",
        },
      ],
    });

    const output = await readFile(outputPath, "utf8");

    expect(output).toMatch(/^\/\/ @name\s+ac-revisit \(dev\)$/m);
    expect(output).toMatch(/^\/\/ @version\s+0\.0\.0\.1700000000$/m);
    expect(output).toMatch(
      /^\/\/ @downloadURL\s+http:\/\/127\.0\.0\.1:4310\/ac-revisit\.dev\.user\.js$/m,
    );
    expect(output).toMatch(
      /^\/\/ @updateURL\s+http:\/\/127\.0\.0\.1:4310\/ac-revisit\.dev\.user\.js$/m,
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
