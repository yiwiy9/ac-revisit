// @vitest-environment node
import { readFile } from "node:fs/promises";
import { expect, test } from "vitest";

async function readJson(filePath: string | URL) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

test("package.json defines isolated tooling scripts and devDependencies", async () => {
  const packageJson = await readJson(new URL("../package.json", import.meta.url));

  expect(packageJson.type).toBe("module");
  expect(packageJson.scripts.lint).toBe("eslint .");
  expect(packageJson.scripts["lint-staged"]).toBe("lint-staged");
  expect(packageJson.scripts["prepush:guard"]).toBe("npm run verify");
  expect(packageJson.scripts.prepare).toBe("husky");
  expect(packageJson.scripts.typecheck).toBe("tsc --noEmit");
  expect(packageJson.scripts["typecheck:scripts"]).toBe("tsc -p tsconfig.scripts.json --noEmit");
  expect(packageJson.scripts["typecheck:test"]).toBe("tsc -p tsconfig.test.json --noEmit");
  expect(packageJson.scripts.verify).toBe(
    "npm run lint && npm run typecheck && npm run typecheck:scripts && npm run typecheck:test && npm test",
  );
  expect(packageJson.scripts.build).toBe("npm run verify && tsx scripts/build-userscript.ts");
  expect(packageJson.scripts.dev).toBe("tsx scripts/dev-userscript.ts");
  expect(packageJson.scripts.test).toBe("vitest run");
  expect(packageJson.devDependencies.typescript).toBe("^5.8.2");
  expect(packageJson.devDependencies.esbuild).toBe("^0.25.0");
  expect(packageJson.devDependencies.eslint).toBe("^9.21.0");
  expect(packageJson.devDependencies.husky).toBe("^9.1.7");
  expect(packageJson.devDependencies["lint-staged"]).toBe("^16.4.0");
  expect(packageJson.devDependencies.prettier).toBe("^3.8.1");
  expect(packageJson.devDependencies.tsx).toBe("^4.21.0");
  expect(packageJson.devDependencies.vitest).toBe("^3.2.4");
  expect(packageJson.devDependencies.jsdom).toBe("^26.0.0");
  expect(packageJson.devDependencies["@types/tampermonkey"]).toBe("^5.0.4");
});

test("tooling config files exist and lock TypeScript plus Tampermonkey typing", async () => {
  const [
    tsconfigRaw,
    tsconfigTestRaw,
    scriptsTsconfigRaw,
    eslintConfigRaw,
    mainSource,
    bootstrapSource,
    platformPortsSource,
    buildScript,
    devScript,
    vitestConfig,
    preCommitHook,
    prePushHook,
    lintStagedConfigRaw,
  ] = await Promise.all([
    readFile(new URL("../tsconfig.json", import.meta.url), "utf8"),
    readFile(new URL("../tsconfig.test.json", import.meta.url), "utf8"),
    readFile(new URL("../tsconfig.scripts.json", import.meta.url), "utf8"),
    readFile(new URL("../eslint.config.js", import.meta.url), "utf8"),
    readFile(new URL("../src/main.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/bootstrap/userscript.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/bootstrap/platform-ports.ts", import.meta.url), "utf8"),
    readFile(new URL("../scripts/build-userscript.ts", import.meta.url), "utf8"),
    readFile(new URL("../scripts/dev-userscript.ts", import.meta.url), "utf8"),
    readFile(new URL("../vitest.config.ts", import.meta.url), "utf8"),
    readFile(new URL("../.husky/pre-commit", import.meta.url), "utf8"),
    readFile(new URL("../.husky/pre-push", import.meta.url), "utf8"),
    readFile(new URL("../.lintstagedrc.json", import.meta.url), "utf8"),
  ]);

  const tsconfig = JSON.parse(tsconfigRaw);
  const tsconfigTest = JSON.parse(tsconfigTestRaw);
  const scriptsTsconfig = JSON.parse(scriptsTsconfigRaw);
  const lintStagedConfig = JSON.parse(lintStagedConfigRaw);

  expect(tsconfig.compilerOptions.noEmit).toBe(true);
  expect(tsconfig.compilerOptions.types).toEqual(["tampermonkey"]);
  expect(tsconfig.compilerOptions.moduleResolution).toBe("Bundler");
  expect(tsconfig.compilerOptions.lib).toEqual(["DOM", "ES2022"]);
  expect(tsconfigTest.compilerOptions.allowJs).toBeUndefined();
  expect(tsconfigTest.compilerOptions.allowImportingTsExtensions).toBe(true);
  expect(tsconfigTest.compilerOptions.types).toEqual(["tampermonkey", "vitest/globals", "node"]);
  expect(scriptsTsconfig.compilerOptions.types).toEqual(["node"]);
  expect(scriptsTsconfig.compilerOptions.module).toBe("NodeNext");
  expect(scriptsTsconfig.compilerOptions.moduleResolution).toBe("NodeNext");
  expect(scriptsTsconfig.compilerOptions.lib).toEqual(["ES2022"]);
  expect(eslintConfigRaw).toMatch(/typescript-eslint/);
  expect(mainSource).toMatch(/\.\/bootstrap\/userscript/);
  expect(mainSource).toMatch(/createUserscriptPlatformPorts/);
  expect(mainSource).toMatch(/bootstrapUserscript\(\{\s*platform:/s);
  expect(platformPortsSource).toMatch(/GM_getValue/);
  expect(platformPortsSource).toMatch(/GM_setValue/);
  expect(bootstrapSource).toMatch(/readUserscriptWorkspaceSnapshot/);
  expect(mainSource).not.toMatch(/: any\b/);
  expect(bootstrapSource).not.toMatch(/: any\b/);
  expect(platformPortsSource).not.toMatch(/: any\b/);
  expect(bootstrapSource).not.toMatch(/declare const GM_/);
  expect(buildScript).toMatch(/interface BuildUserscriptOptions/);
  expect(buildScript).toMatch(/from "esbuild"/);
  expect(buildScript).toMatch(/src\/main\.ts/);
  expect(devScript).toMatch(/buildUserscript/);
  expect(devScript).toMatch(/downloadURL/);
  expect(devScript).toMatch(/createServer|http\.createServer/);
  expect(vitestConfig).toMatch(/environment:\s*"jsdom"/);
  expect(bootstrapSource).toMatch(/createPopupShellPresenter/);
  expect(preCommitHook).toMatch(/npm run lint-staged/);
  expect(prePushHook).toMatch(/npm run prepush:guard/);
  expect(lintStagedConfig["*.{js,mjs,cjs,ts,tsx}"]).toEqual([
    "prettier --write",
    "eslint --max-warnings=0 --fix",
  ]);
});
