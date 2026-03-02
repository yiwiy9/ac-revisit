import { createLocalDateProvider } from "./shared/date";
import {
  createAtCoderPageAdapter,
  createAuthSessionGuard,
  createMenuEntryAdapter,
} from "./runtime/shell";

const STORAGE_PROBE_KEY = "ac-revisit:toolchain-probe";

export interface UserscriptStorageProbe {
  read(): string | null;
  write(value: string): void;
}

export interface UserscriptBootstrapResult {
  readonly session: "authenticated" | "anonymous";
  readonly menuEntryMounted: boolean;
}

export function createUserscriptStorageProbe(): UserscriptStorageProbe {
  return {
    read() {
      return GM_getValue<string | null>(STORAGE_PROBE_KEY, null);
    },
    write(value) {
      return GM_setValue(STORAGE_PROBE_KEY, value);
    },
  };
}

export function bootstrapUserscript(): UserscriptBootstrapResult {
  const pageAdapter = createAtCoderPageAdapter();
  const sessionGuard = createAuthSessionGuard(pageAdapter);
  const session = sessionGuard.resolveSession();

  if (session.kind === "anonymous") {
    return {
      session: "anonymous",
      menuEntryMounted: false,
    };
  }

  const localDateProvider = createLocalDateProvider();
  const menuEntryAdapter = createMenuEntryAdapter({
    pageAdapter,
    getToday: () => localDateProvider.today(),
    openPopup() {
      // Popup integration is implemented in later tasks; keep the menu action wired.
    },
  });
  const mountResult = menuEntryAdapter.ensureEntryMounted();

  return {
    session: "authenticated",
    menuEntryMounted: mountResult.ok && mountResult.value.mounted,
  };
}

bootstrapUserscript();
