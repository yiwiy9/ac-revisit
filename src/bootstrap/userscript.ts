import { createCandidateSelectionService } from "../domain/candidate-selection";
import { createDailySuggestionService } from "../domain/daily-suggestion";
import { createReviewMutationService } from "../domain/review-mutation";
import { createReviewStoreAdapter, type ReviewStorePort } from "../persistence/review-store";
import {
  createPopupStateLoader,
  createPopupShellPresenter,
  type PopupShellActionInput,
  type PopupStateSnapshot,
} from "../presentation/popup-shell";
import { createLocalDateMath, createLocalDateProvider } from "../shared/date";
import type { DailySuggestionState, LocalDateKey, ReviewWorkspace } from "../shared/types";
import {
  createAtCoderPageAdapter,
  createAuthSessionGuard,
  createMenuEntryAdapter,
  createToggleMountCoordinator,
} from "../runtime/atcoder-shell";

const STORAGE_PROBE_KEY = "ac-revisit:toolchain-probe";

export type DiagnosticCode = "anchor_missing" | "problem_unresolvable" | "storage_unavailable";

export interface DiagnosticEvent {
  readonly code: DiagnosticCode;
  readonly component: string;
  readonly operation: string;
}

export type DiagnosticSink = (event: DiagnosticEvent) => void;

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
  readonly diagnosticSink?: DiagnosticSink;
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
  const recordDiagnostic = createDiagnosticRecorder(dependencies.diagnosticSink);
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
  const popupStateLoader = createPopupStateLoader({
    readWorkspace() {
      return reviewStore.readWorkspace();
    },
    listDueCandidates(input) {
      return candidateSelectionService.listDueCandidates(input);
    },
  });

  function loadWorkspacePopupState(input: {
    readonly source: "menu" | "bootstrap";
    readonly today: LocalDateKey;
    readonly reviewWorkspace: ReviewWorkspace;
  }): PopupStateSnapshot {
    const result = popupStateLoader.load({
      mode: "workspace",
      source: input.source,
      today: input.today,
      reviewWorkspace: input.reviewWorkspace,
    });

    if (!result.ok) {
      throw new Error("workspace popup state loading must not fail");
    }

    return result.value;
  }

  function refreshPopupState(input: {
    readonly source: "menu" | "bootstrap";
    readonly today: LocalDateKey;
  }): PopupStateSnapshot | null {
    const result = dailySuggestionService.ensureTodaySuggestion({
      today: input.today,
      trigger: "menu",
    });

    if (!result.ok) {
      recordDiagnostic({
        code: result.error.kind,
        component: "DailySuggestionService",
        operation: "popup_refresh",
      });
      return null;
    }

    return loadWorkspacePopupState({
      source: input.source,
      today: input.today,
      reviewWorkspace: result.value.reviewWorkspace,
    });
  }

  function loadReadonlyPopupState(input: {
    readonly source: "menu" | "bootstrap";
    readonly today: LocalDateKey;
  }): PopupStateSnapshot | null {
    const result = popupStateLoader.load({
      mode: "readonly",
      source: input.source,
      today: input.today,
    });

    if (!result.ok) {
      recordDiagnostic({
        code: result.error.kind,
        component: "PopupStateLoader",
        operation: "popup_readonly_load",
      });
      return null;
    }

    return result.value;
  }

  function runPopupPrimaryAction(input: PopupShellActionInput): PopupStateSnapshot | null {
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
      if (result.error.kind === "storage_unavailable") {
        recordDiagnostic({
          code: result.error.kind,
          component: "ReviewMutationService",
          operation: "popup_primary_action",
        });
      }

      return refreshPopupState({
        source: input.source,
        today: input.today,
      });
    }

    return loadWorkspacePopupState({
      source: input.source,
      today: input.today,
      reviewWorkspace: result.value.reviewWorkspace,
    });
  }

  const defaultPopupPresenter =
    dependencies.openPopup === undefined
      ? createPopupShellPresenter(document, {
          getToday,
          loadReadonly: loadReadonlyPopupState,
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

    defaultPopupPresenter(loadWorkspacePopupState(input));
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
        recordDiagnostic({
          code: menuSuggestionResult.error.kind,
          component: "DailySuggestionService",
          operation: "menu_open_popup",
        });
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

  if (!mountResult.ok) {
    recordDiagnostic({
      code: mountResult.error.kind,
      component: "MenuEntryAdapter",
      operation: "startup_menu_mount",
    });
  }

  const toggleMountCoordinator = createToggleMountCoordinator({
    pageAdapter,
    getToday,
    resolveIsRegistered(problemId) {
      const workspace = reviewStore.readWorkspace();

      if (!workspace.ok) {
        recordDiagnostic({
          code: workspace.error.kind,
          component: "ReviewStoreAdapter",
          operation: "startup_toggle_state_load",
        });
      }

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
        if (result.error.kind === "storage_unavailable") {
          recordDiagnostic({
            code: result.error.kind,
            component: "ReviewMutationService",
            operation: "toggle_click",
          });
        }

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

  if (toggleMountResult !== null && !toggleMountResult.ok) {
    recordDiagnostic({
      code: toggleMountResult.error.kind,
      component: "ToggleMountCoordinator",
      operation: "startup_toggle_mount",
    });
  }

  const today = getToday();
  const dailySuggestionResult = dailySuggestionService.ensureTodaySuggestion({
    today,
    trigger: "bootstrap",
  });

  if (!dailySuggestionResult.ok) {
    recordDiagnostic({
      code: dailySuggestionResult.error.kind,
      component: "DailySuggestionService",
      operation: "startup_daily_suggestion",
    });
  }

  if (dailySuggestionResult.ok && dailySuggestionResult.value.shouldAutoOpenPopup) {
    presentPopup({
      source: "bootstrap",
      today,
      reviewWorkspace: dailySuggestionResult.value.reviewWorkspace,
    });
  }

  return {
    session: "authenticated",
    menuEntryMounted: mountResult.ok && mountResult.value.mounted,
    toggleMounted: toggleMountResult?.ok === true && toggleMountResult.value.mounted,
  };
}

function createDiagnosticRecorder(diagnosticSink?: DiagnosticSink): DiagnosticSink {
  return (event) => {
    diagnosticSink?.(event);
  };
}
