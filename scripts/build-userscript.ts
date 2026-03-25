import { build as bundle } from "esbuild";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PUBLISHED_USERSCRIPT_NAME = "ac-revisit";
const DEFAULT_NAMESPACE = "https://github.com/yiwiy9/ac-revisit";
const DEFAULT_HOMEPAGE_URL = "https://github.com/yiwiy9/ac-revisit";
const DEFAULT_AUTHOR = "yiwiy9";
const DEFAULT_LICENSE = "MIT";
const DEFAULT_DESCRIPTION = "AtCoder の復習問題を登録し、今日の一問を提案する userscript";
const DEFAULT_MATCH = "https://atcoder.jp/*";
const DEFAULT_GRANTS = ["GM_getValue", "GM_setValue"];
const DEFAULT_RUN_AT = "document-end";

interface UserscriptMetadataEntry {
  readonly key: string;
  readonly value: string;
}

interface BuildUserscriptOptions {
  packageJsonPath?: string | URL;
  outputPath?: string | URL;
  entryPointPath?: string | URL;
  releaseChannel?: "published" | "development";
  userscriptName?: string;
  userscriptVersion?: string;
  extraMetadata?: readonly UserscriptMetadataEntry[];
  reviewIntervalDays?: number;
}

const REVIEW_INTERVAL_DAYS_ENV_NAME = "AC_REVISIT_REVIEW_INTERVAL_DAYS";

function toFilesystemPath(targetPath: string | URL): string {
  if (targetPath instanceof URL) {
    return fileURLToPath(targetPath);
  }

  return targetPath;
}

function buildMetadataBlock({
  name,
  version,
  extraMetadata = [],
}: {
  name: string;
  version: string;
  extraMetadata?: readonly UserscriptMetadataEntry[];
}): string {
  return [
    "// ==UserScript==",
    `// @name ${name}`,
    `// @namespace ${DEFAULT_NAMESPACE}`,
    `// @homepageURL ${DEFAULT_HOMEPAGE_URL}`,
    `// @author ${DEFAULT_AUTHOR}`,
    `// @license ${DEFAULT_LICENSE}`,
    `// @version ${version}`,
    `// @description ${DEFAULT_DESCRIPTION}`,
    `// @match ${DEFAULT_MATCH}`,
    ...DEFAULT_GRANTS.map((grant) => `// @grant ${grant}`),
    ...extraMetadata.map((entry) => `// @${entry.key} ${entry.value}`),
    `// @run-at ${DEFAULT_RUN_AT}`,
    "// ==/UserScript==",
    "",
  ].join("\n");
}

export async function buildUserscript({
  packageJsonPath = new URL("../package.json", import.meta.url),
  outputPath = new URL("../dist/ac-revisit.user.js", import.meta.url),
  entryPointPath = new URL("../src/main.ts", import.meta.url),
  releaseChannel = "published",
  userscriptName,
  userscriptVersion,
  extraMetadata = [],
  reviewIntervalDays = resolveReviewIntervalDaysFromEnv(),
}: BuildUserscriptOptions = {}): Promise<{ outputPath: string }> {
  const resolvedPackageJsonPath = toFilesystemPath(packageJsonPath);
  const resolvedOutputPath = toFilesystemPath(outputPath);
  const resolvedEntryPointPath = toFilesystemPath(entryPointPath);
  const rawPackageJson = await readFile(resolvedPackageJsonPath, "utf8");
  const packageJson = JSON.parse(rawPackageJson) as { name?: unknown; version?: unknown };
  const missingFields: string[] = [];

  if (typeof packageJson.name !== "string" || packageJson.name.length === 0) {
    missingFields.push("name");
  }

  if (typeof packageJson.version !== "string" || packageJson.version.length === 0) {
    missingFields.push("version");
  }

  if (missingFields.length > 0) {
    throw new Error(`Missing required package metadata: ${missingFields.join(", ")}`);
  }

  const packageName = packageJson.name as string;
  const packageVersion = packageJson.version as string;
  const resolvedUserscriptName = userscriptName ?? packageName;
  const resolvedUserscriptVersion = userscriptVersion ?? packageVersion;

  if (packageName !== PUBLISHED_USERSCRIPT_NAME) {
    throw new Error(`Published userscript name must remain ${PUBLISHED_USERSCRIPT_NAME}`);
  }

  if (releaseChannel === "published" && resolvedUserscriptName !== packageName) {
    throw new Error(`Published metadata must use package.json name: ${packageName}`);
  }

  if (releaseChannel === "published" && resolvedUserscriptVersion !== packageVersion) {
    throw new Error(`Published metadata must use package.json version: ${packageVersion}`);
  }

  if (releaseChannel === "published" && extraMetadata.length > 0) {
    throw new Error("Published builds must not define extra metadata entries");
  }

  const bundleResult = await bundle({
    entryPoints: [resolvedEntryPointPath],
    bundle: true,
    charset: "utf8",
    define: {
      __AC_REVISIT_DEV__: JSON.stringify(releaseChannel === "development"),
      __AC_REVISIT_REVIEW_INTERVAL_DAYS__: JSON.stringify(reviewIntervalDays),
    },
    format: "iife",
    legalComments: "none",
    platform: "browser",
    target: ["es2022"],
    write: false,
  });
  const runtime = bundleResult.outputFiles.at(0)?.text;

  if (!runtime) {
    throw new Error("Build failed: no bundle output was generated");
  }

  const userscript = `${buildMetadataBlock({
    name: resolvedUserscriptName,
    version: resolvedUserscriptVersion,
    extraMetadata,
  })}${runtime}`;

  await mkdir(path.dirname(resolvedOutputPath), { recursive: true });
  await writeFile(resolvedOutputPath, userscript, "utf8");

  return {
    outputPath: resolvedOutputPath,
  };
}

function resolveReviewIntervalDaysFromEnv(): number {
  const rawValue = process.env[REVIEW_INTERVAL_DAYS_ENV_NAME];

  if (rawValue === undefined) {
    return 14;
  }

  const parsedValue = Number(rawValue);

  if (!Number.isInteger(parsedValue) || parsedValue < 0) {
    throw new Error(`${REVIEW_INTERVAL_DAYS_ENV_NAME} must be a non-negative integer: ${rawValue}`);
  }

  return parsedValue;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await buildUserscript();
}
