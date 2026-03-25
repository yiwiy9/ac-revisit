import type { ReviewStorePort } from "../persistence/review-store";

import type { DiagnosticEvent, DiagnosticSink } from "./userscript";

export interface PlatformPorts {
  readonly rng: () => number;
  readonly reviewStorage: ReviewStorePort;
  readonly diagnosticSink: DiagnosticSink;
}

export function createUserscriptPlatformPorts({
  rng = Math.random,
  dev = false,
  consoleRef = console,
  gmGetValue,
  gmSetValue,
}: {
  gmGetValue?: typeof GM_getValue;
  gmSetValue?: typeof GM_setValue;
  rng?: () => number;
  dev?: boolean;
  consoleRef?: Pick<Console, "debug">;
} = {}): PlatformPorts {
  const resolvedGMGetValue = gmGetValue ?? globalThis.GM_getValue;
  const resolvedGMSetValue = gmSetValue ?? globalThis.GM_setValue;

  return {
    rng,
    reviewStorage: {
      get(key) {
        return resolvedGMGetValue<string | null>(key, null);
      },
      set(key, value) {
        resolvedGMSetValue(key, value);
      },
    },
    diagnosticSink: createDiagnosticSink({ dev, consoleRef }),
  };
}

function createDiagnosticSink({
  dev,
  consoleRef,
}: {
  dev: boolean;
  consoleRef: Pick<Console, "debug">;
}): DiagnosticSink {
  if (!dev) {
    return () => undefined;
  }

  return (event: DiagnosticEvent) => {
    consoleRef.debug(`ac-revisit:${event.code}`, event.component, event.operation);
  };
}
