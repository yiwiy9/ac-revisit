import { expect, test, vi } from "vitest";

import type { DiagnosticEvent } from "../src/bootstrap/userscript.ts";
import { createUserscriptPlatformPorts } from "../src/bootstrap/platform-ports.ts";

test("createUserscriptPlatformPorts bundles rng, userscript storage, and dev diagnostics", () => {
  const gmGetValue = vi.fn(<TValue>(key: string, defaultValue?: TValue) => {
    if (key === "ac_revisit_workspace_v1") {
      return '{"version":1}' as TValue;
    }

    return defaultValue as TValue;
  });
  const gmSetValue = vi.fn();
  const debug = vi.fn();

  const ports = createUserscriptPlatformPorts({
    gmGetValue,
    gmSetValue,
    rng: () => 0.75,
    dev: true,
    consoleRef: { debug },
  });

  expect(ports.rng()).toBe(0.75);
  expect(ports.reviewStorage.get("ac_revisit_workspace_v1")).toBe('{"version":1}');

  ports.reviewStorage.set("ac_revisit_workspace_v1", '{"version":2}');
  ports.diagnosticSink({
    code: "anchor_missing",
    component: "ToggleMountCoordinator",
    operation: "startup_toggle_mount",
  } satisfies DiagnosticEvent);

  expect(gmGetValue).toHaveBeenCalledWith("ac_revisit_workspace_v1", null);
  expect(gmSetValue).toHaveBeenCalledWith("ac_revisit_workspace_v1", '{"version":2}');
  expect(debug).toHaveBeenCalledWith(
    "ac-revisit:anchor_missing",
    "ToggleMountCoordinator",
    "startup_toggle_mount",
  );
});

test("createUserscriptPlatformPorts keeps diagnostics silent outside development mode", () => {
  const debug = vi.fn();
  const ports = createUserscriptPlatformPorts({
    gmGetValue: <TValue>(_key: string, defaultValue?: TValue) => defaultValue as TValue,
    gmSetValue: () => undefined,
    dev: false,
    consoleRef: { debug },
  });

  ports.diagnosticSink({
    code: "storage_unavailable",
    component: "DailySuggestionService",
    operation: "startup_daily_suggestion",
  });

  expect(debug).not.toHaveBeenCalled();
});
