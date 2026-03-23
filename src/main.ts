export {
  bootstrapUserscript,
  createUserscriptStorageProbe,
  type BootstrapUserscriptDependencies,
  type DiagnosticCode,
  type DiagnosticEvent,
  type DiagnosticSink,
  type PopupRequest,
  type UserscriptBootstrapResult,
  type UserscriptStorageProbe,
} from "./bootstrap/userscript";

import {
  bootstrapUserscript,
  readUserscriptWorkspaceSnapshot,
  type DiagnosticEvent,
  type DiagnosticSink,
} from "./bootstrap/userscript";

declare const __AC_REVISIT_DEV__: boolean;

function createConsoleDiagnosticSink(consoleRef: Pick<Console, "debug">): DiagnosticSink {
  return (event: DiagnosticEvent) => {
    consoleRef.debug(`ac-revisit:${event.code}`, event.component, event.operation);
  };
}

function logDevWorkspaceSnapshot(consoleRef: Pick<Console, "debug" | "warn">) {
  try {
    consoleRef.debug("ac-revisit:workspace", readUserscriptWorkspaceSnapshot());
  } catch (error) {
    consoleRef.warn("ac-revisit:workspace_dump_failed", error);
  }
}

if (__AC_REVISIT_DEV__) {
  bootstrapUserscript({
    diagnosticSink: createConsoleDiagnosticSink(console),
  });
  logDevWorkspaceSnapshot(console);
} else {
  bootstrapUserscript();
}
