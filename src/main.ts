import { createLocalDateProvider } from "./shared/date";
import {
  createAtCoderPageAdapter,
  createAuthSessionGuard,
  createMenuEntryAdapter,
  createToggleMountCoordinator,
} from "./runtime/shell";

const STORAGE_PROBE_KEY = "ac-revisit:toolchain-probe";

export interface UserscriptStorageProbe {
  read(): string | null;
  write(value: string): void;
}

export interface UserscriptBootstrapResult {
  readonly session: "authenticated" | "anonymous";
  readonly menuEntryMounted: boolean;
  readonly toggleMounted: boolean;
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
      toggleMounted: false,
    };
  }

  const page = pageAdapter.detectPage();
  const menuEntryAdapter = createMenuEntryAdapter({
    pageAdapter,
    getToday: () => createLocalDateProvider().today(),
    openPopup() {
      // Popup integration is implemented in later tasks; keep the menu action wired.
    },
  });
  const mountResult = menuEntryAdapter.ensureEntryMounted();
  const toggleMountCoordinator = createToggleMountCoordinator({ pageAdapter });
  const toggleMountResult =
    page.kind === "problem" || page.kind === "submission_detail"
      ? toggleMountCoordinator.mount()
      : null;

  return {
    session: "authenticated",
    menuEntryMounted: mountResult.ok && mountResult.value.mounted,
    toggleMounted: toggleMountResult?.ok === true && toggleMountResult.value.mounted,
  };
}

bootstrapUserscript();
