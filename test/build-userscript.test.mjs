import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { buildUserscript } from "../scripts/build-userscript.mjs";

test("package.json exposes the canonical build script for the userscript bundle", async () => {
  const packageJsonPath = new URL("../package.json", import.meta.url);
  const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));

  assert.equal(packageJson.scripts.build, "node scripts/build-userscript.mjs");
});

test("buildUserscript emits a single userscript bundle with required metadata", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "ac-revisit-build-"));

  try {
    const outputPath = path.join(tempDir, "ac-revisit.user.js");

    await buildUserscript({
      packageJsonPath: new URL("../package.json", import.meta.url),
      outputPath,
    });

    const output = await readFile(outputPath, "utf8");

    assert.match(output, /^\/\/ ==UserScript==/m);
    assert.match(output, /^\/\/ @name\s+ac-revisit$/m);
    assert.match(output, /^\/\/ @namespace\s+https:\/\/github\.com\/openai\/ac-revisit$/m);
    assert.match(output, /^\/\/ @version\s+0\.0\.0$/m);
    assert.match(output, /^\/\/ @description\s+AtCoder で復習したい問題を静かに提案する userscript$/m);
    assert.match(output, /^\/\/ @match\s+https:\/\/atcoder\.jp\/\*$/m);
    assert.match(output, /^\/\/ @grant\s+GM_getValue$/m);
    assert.match(output, /^\/\/ @grant\s+GM_setValue$/m);
    assert.match(output, /^\/\/ @run-at\s+document-end$/m);
    assert.match(output, /^\/\/ ==\/UserScript==/m);
    assert.match(output, /\(\(\) => \{/);
    assert.doesNotMatch(output, /@require/);
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

    await assert.rejects(
      buildUserscript({
        packageJsonPath,
        outputPath: path.join(tempDir, "ac-revisit.user.js"),
      }),
      /Missing required package metadata: version/,
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
