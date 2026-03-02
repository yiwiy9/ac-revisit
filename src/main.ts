import { createReviewMutationService } from "./domain/review-mutation";
import { createReviewStoreAdapter, type ReviewStorePort } from "./persistence/review-store";
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

export interface BootstrapUserscriptDependencies {
  readonly reviewStorage?: ReviewStorePort;
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

function createUserscriptReviewStorage(): ReviewStorePort {
  return {
    get(key) {
      return GM_getValue<string | null>(key, null);
    },
    set(key, value) {
      GM_setValue(key, value);
    },
  };
}

export function bootstrapUserscript(
  dependencies: BootstrapUserscriptDependencies = {},
): UserscriptBootstrapResult {
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

  const localDateProvider = createLocalDateProvider();
  const reviewStore = createReviewStoreAdapter(
    dependencies.reviewStorage ?? createUserscriptReviewStorage(),
  );
  const reviewMutationService = createReviewMutationService({
    reviewStore,
  });
  const page = pageAdapter.detectPage();
  const menuEntryAdapter = createMenuEntryAdapter({
    pageAdapter,
    getToday: () => localDateProvider.today(),
    openPopup() {
      // Popup integration is implemented in later tasks; keep the menu action wired.
    },
  });
  const mountResult = menuEntryAdapter.ensureEntryMounted();
  const toggleMountCoordinator = createToggleMountCoordinator({
    pageAdapter,
    getToday: () => localDateProvider.today(),
    resolveIsRegistered(problemId) {
      const workspace = reviewStore.readWorkspace();

      return (
        workspace.ok && workspace.value.reviewItems.some((item) => item.problemId === problemId)
      );
    },
    onToggle(input) {
      const result = input.isRegistered
        ? reviewMutationService.unregisterProblem({
            problemId: input.problemId,
            today: input.today,
          })
        : reviewMutationService.registerProblem({
            problemId: input.problemId,
            problemTitle: input.problemTitle,
            today: input.today,
          });

      if (!result.ok) {
        return input.isRegistered;
      }

      return result.value.reviewWorkspace.reviewItems.some(
        (item) => item.problemId === input.problemId,
      );
    },
  });
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
