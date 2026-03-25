export {
  bootstrapUserscript,
  type BootstrapUserscriptDependencies,
  type DiagnosticCode,
  type DiagnosticEvent,
  type DiagnosticSink,
  type PopupRequest,
  type UserscriptBootstrapResult,
} from "./bootstrap/userscript";
export { createUserscriptPlatformPorts, type PlatformPorts } from "./bootstrap/platform-ports";

import { bootstrapUserscript, readUserscriptWorkspaceSnapshot } from "./bootstrap/userscript";
import { createUserscriptPlatformPorts } from "./bootstrap/platform-ports";

declare const __AC_REVISIT_DEV__: boolean;

function logDevWorkspaceSnapshot(consoleRef: Pick<Console, "debug" | "warn">) {
  try {
    consoleRef.debug("ac-revisit:workspace", readUserscriptWorkspaceSnapshot());
  } catch (error) {
    consoleRef.warn("ac-revisit:workspace_dump_failed", error);
  }
}

if (__AC_REVISIT_DEV__) {
  bootstrapUserscript({
    platform: createUserscriptPlatformPorts({
      dev: true,
      consoleRef: console,
    }),
  });
  logDevWorkspaceSnapshot(console);
} else {
  bootstrapUserscript({
    platform: createUserscriptPlatformPorts(),
  });
}
