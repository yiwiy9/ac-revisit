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

import { bootstrapUserscript } from "./bootstrap/userscript";

bootstrapUserscript();
