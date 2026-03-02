import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

test("package.json defines isolated tooling scripts and devDependencies", async () => {
  const packageJson = await readJson(new URL("../package.json", import.meta.url));

  assert.equal(packageJson.type, "module");
  assert.equal(packageJson.scripts.lint, "eslint .");
  assert.equal(packageJson.scripts.typecheck, "tsc --noEmit");
  assert.equal(packageJson.scripts.verify, "npm run lint && npm run typecheck");
  assert.equal(packageJson.scripts.build, "npm run verify && node scripts/build-userscript.mjs");
  assert.equal(
    packageJson.devDependencies.typescript,
    "^5.8.2",
  );
  assert.equal(packageJson.devDependencies.esbuild, "^0.25.0");
  assert.equal(packageJson.devDependencies.eslint, "^9.21.0");
  assert.equal(
    packageJson.devDependencies["@types/tampermonkey"],
    "^5.0.4",
  );
});

test("tooling config files exist and lock TypeScript plus Tampermonkey typing", async () => {
  const [tsconfigRaw, eslintConfigRaw, mainSource, buildScript] = await Promise.all([
    readFile(new URL("../tsconfig.json", import.meta.url), "utf8"),
    readFile(new URL("../eslint.config.js", import.meta.url), "utf8"),
    readFile(new URL("../src/main.ts", import.meta.url), "utf8"),
    readFile(new URL("../scripts/build-userscript.mjs", import.meta.url), "utf8"),
  ]);

  const tsconfig = JSON.parse(tsconfigRaw);

  assert.equal(tsconfig.compilerOptions.noEmit, true);
  assert.deepEqual(tsconfig.compilerOptions.types, ["tampermonkey"]);
  assert.match(eslintConfigRaw, /typescript-eslint/);
  assert.match(mainSource, /GM_getValue/);
  assert.match(mainSource, /GM_setValue/);
  assert.doesNotMatch(mainSource, /: any\b/);
  assert.doesNotMatch(mainSource, /declare const GM_/);
  assert.match(buildScript, /from "esbuild"/);
  assert.match(buildScript, /src\/main\.ts/);
});
