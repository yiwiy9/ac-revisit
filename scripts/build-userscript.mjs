import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_NAMESPACE = "https://github.com/openai/ac-revisit";
const DEFAULT_DESCRIPTION = "AtCoder で復習したい問題を静かに提案する userscript";
const DEFAULT_MATCH = "https://atcoder.jp/*";
const DEFAULT_GRANTS = ["GM_getValue", "GM_setValue"];
const DEFAULT_RUN_AT = "document-end";
const DEFAULT_RUNTIME = `(() => {
  "use strict";

  // Runtime implementation will be introduced in later tasks.
})();
`;

function toFilesystemPath(targetPath) {
  if (targetPath instanceof URL) {
    return fileURLToPath(targetPath);
  }

  return targetPath;
}

function buildMetadataBlock({ name, version }) {
  return [
    "// ==UserScript==",
    `// @name ${name}`,
    `// @namespace ${DEFAULT_NAMESPACE}`,
    `// @version ${version}`,
    `// @description ${DEFAULT_DESCRIPTION}`,
    `// @match ${DEFAULT_MATCH}`,
    ...DEFAULT_GRANTS.map((grant) => `// @grant ${grant}`),
    `// @run-at ${DEFAULT_RUN_AT}`,
    "// ==/UserScript==",
    "",
  ].join("\n");
}

export async function buildUserscript({
  packageJsonPath = new URL("../package.json", import.meta.url),
  outputPath = new URL("../dist/ac-revisit.user.js", import.meta.url),
} = {}) {
  const resolvedPackageJsonPath = toFilesystemPath(packageJsonPath);
  const resolvedOutputPath = toFilesystemPath(outputPath);
  const rawPackageJson = await readFile(resolvedPackageJsonPath, "utf8");
  const packageJson = JSON.parse(rawPackageJson);
  const missingFields = [];

  if (!packageJson.name) {
    missingFields.push("name");
  }

  if (!packageJson.version) {
    missingFields.push("version");
  }

  if (missingFields.length > 0) {
    throw new Error(
      `Missing required package metadata: ${missingFields.join(", ")}`,
    );
  }

  const userscript = `${buildMetadataBlock({
    name: packageJson.name,
    version: packageJson.version,
  })}${DEFAULT_RUNTIME}`;

  await mkdir(path.dirname(resolvedOutputPath), { recursive: true });
  await writeFile(resolvedOutputPath, userscript, "utf8");

  return {
    outputPath: resolvedOutputPath,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await buildUserscript();
}
