import { createCandidateSelectionService } from "./domain/candidate-selection";
import { createDailySuggestionService } from "./domain/daily-suggestion";
import { createReviewMutationService } from "./domain/review-mutation";
import { createReviewStoreAdapter, type ReviewStorePort } from "./persistence/review-store";
import {
  createPopupShellPresenter,
  type PopupShellActionInput,
  type PopupShellRequest,
} from "./presentation/popup-shell";
import { createLocalDateMath, createLocalDateProvider } from "./shared/date";
import type { DailySuggestionState, LocalDateKey, ReviewWorkspace } from "./shared/types";
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
  readonly dailyState: DailySuggestionState;
  readonly activeProblemTitle?: string | null;
  readonly hasDueCandidates?: boolean;
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
  const localDateMath = createLocalDateMath();
  const candidateSelectionService = createCandidateSelectionService({
    localDateMath,
  });
  const dailySuggestionService = createDailySuggestionService({
    reviewStore,
    localDateMath,
    candidateSelectionService,
  });
  const reviewMutationService = createReviewMutationService({
    reviewStore,
    candidateSelectionService,
  });

  function toPopupShellRequest(input: {
    readonly source: "menu" | "bootstrap";
    readonly today: LocalDateKey;
    readonly reviewWorkspace: ReviewWorkspace;
  }): PopupShellRequest {
    const dueCandidates = candidateSelectionService.listDueCandidates({
      today: input.today,
      reviewItems: input.reviewWorkspace.reviewItems,
    });

    return {
      source: input.source,
      today: input.today,
      reviewItems: input.reviewWorkspace.reviewItems,
      dailyState: input.reviewWorkspace.dailyState,
      hasDueCandidates: dueCandidates.length > 0,
    };
  }

  function refreshPopupState(input: {
    readonly source: "menu" | "bootstrap";
    readonly today: LocalDateKey;
  }): PopupShellRequest | null {
    const result = dailySuggestionService.ensureTodaySuggestion({
      today: input.today,
      trigger: "menu",
    });

    if (!result.ok) {
      return null;
    }

    return toPopupShellRequest({
      source: input.source,
      today: input.today,
      reviewWorkspace: result.value.reviewWorkspace,
    });
  }

  function runPopupPrimaryAction(input: PopupShellActionInput): PopupShellRequest | null {
    const result =
      input.action === "complete"
        ? reviewMutationService.completeTodayProblem({
            today: input.today,
            expectedDailyState: input.expectedDailyState,
          })
        : reviewMutationService.fetchNextTodayProblem({
            today: input.today,
            expectedDailyState: input.expectedDailyState,
          });

    if (!result.ok) {
      return result.error.kind === "stale_session"
        ? refreshPopupState({
            source: input.source,
            today: input.today,
          })
        : null;
    }

    return toPopupShellRequest({
      source: input.source,
      today: input.today,
      reviewWorkspace: result.value.reviewWorkspace,
    });
  }

  const defaultPopupPresenter =
    dependencies.openPopup === undefined
      ? createPopupShellPresenter(document, {
          getToday,
          refreshPopup: refreshPopupState,
          runPrimaryAction: runPopupPrimaryAction,
        })
      : null;

  function presentPopup(input: {
    readonly source: "menu" | "bootstrap";
    readonly today: LocalDateKey;
    readonly reviewWorkspace: ReviewWorkspace;
  }) {
    if (defaultPopupPresenter === null) {
      dependencies.openPopup?.({
        source: input.source,
        today: input.today,
        dailyState: input.reviewWorkspace.dailyState,
      });
      return;
    }

    defaultPopupPresenter(toPopupShellRequest(input));
  }

  const page = pageAdapter.detectPage();
  const today = getToday();
  const dailySuggestionResult = dailySuggestionService.ensureTodaySuggestion({
    today,
    trigger: "bootstrap",
  });

  if (dailySuggestionResult.ok && dailySuggestionResult.value.shouldAutoOpenPopup) {
    presentPopup({
      source: "bootstrap",
      today,
      reviewWorkspace: dailySuggestionResult.value.reviewWorkspace,
    });
  }

  const menuEntryAdapter = createMenuEntryAdapter({
    pageAdapter,
    getToday,
    openPopup(input) {
      const menuSuggestionResult = dailySuggestionService.ensureTodaySuggestion({
        today: input.today,
        trigger: "menu",
      });

      if (!menuSuggestionResult.ok) {
        return;
      }

      presentPopup({
        source: input.source,
        today: input.today,
        reviewWorkspace: menuSuggestionResult.value.reviewWorkspace,
      });
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
