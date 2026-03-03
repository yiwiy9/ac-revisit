import { createDailySuggestionService } from "./domain/daily-suggestion";
import { createReviewMutationService } from "./domain/review-mutation";
import { createReviewStoreAdapter, type ReviewStorePort } from "./persistence/review-store";
import { createPopupShellPresenter } from "./presentation/popup-shell";
import { createLocalDateMath, createLocalDateProvider } from "./shared/date";
import type { LocalDateKey } from "./shared/types";
import {
  createAtCoderPageAdapter,
  createAuthSessionGuard,
  createMenuEntryAdapter,
  createToggleMountCoordinator,
} from "./runtime/shell";

const STORAGE_PROBE_KEY = "ac-revisit:toolchain-probe";

export interface PopupRequest {
  readonly source: "menu" | "bootstrap";
  readonly today: LocalDateKey;
}

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
  readonly getToday?: () => LocalDateKey;
  readonly openPopup?: (input: PopupRequest) => void;
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
  const getToday = dependencies.getToday ?? (() => localDateProvider.today());
  const reviewStore = createReviewStoreAdapter(
    dependencies.reviewStorage ?? createUserscriptReviewStorage(),
  );
  const openPopup = dependencies.openPopup ?? createPopupShellPresenter();
  const dailySuggestionService = createDailySuggestionService({
    reviewStore,
    localDateMath: createLocalDateMath(),
  });
  const reviewMutationService = createReviewMutationService({
    reviewStore,
  });
  const page = pageAdapter.detectPage();
  const today = getToday();
  const dailySuggestionResult = dailySuggestionService.ensureTodaySuggestion({
    today,
    trigger: "bootstrap",
  });

  if (dailySuggestionResult.ok && dailySuggestionResult.value.shouldAutoOpenPopup) {
    openPopup({
      source: "bootstrap",
      today,
    });
  }

  const menuEntryAdapter = createMenuEntryAdapter({
    pageAdapter,
    getToday,
    openPopup(input) {
      openPopup(input);
    },
  });
  const mountResult = menuEntryAdapter.ensureEntryMounted();
  const toggleMountCoordinator = createToggleMountCoordinator({
    pageAdapter,
    getToday,
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
