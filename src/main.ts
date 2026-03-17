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
  type DiagnosticEvent,
  type DiagnosticSink,
} from "./bootstrap/userscript";

declare const __AC_REVISIT_DEV__: boolean;

function createConsoleDiagnosticSink(consoleRef: Pick<Console, "debug">): DiagnosticSink {
  return (event: DiagnosticEvent) => {
    consoleRef.debug(`ac-revisit:${event.code}`, event.component, event.operation);
  };
}

if (__AC_REVISIT_DEV__) {
  bootstrapUserscript({
    diagnosticSink: createConsoleDiagnosticSink(console),
  });
} else {
  bootstrapUserscript();
}
