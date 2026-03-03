import { createInteractionSessionValidator } from "../domain/interaction-session";
import type {
  DailySuggestionState,
  LocalDateKey,
  Result,
  ReviewItem,
  ReviewWorkspace,
} from "../shared/types";
import {
  createPopupViewModelFactory,
  type PopupViewModel,
} from "./popup-view-model";

const POPUP_ROOT_ID = "ac-revisit-popup-root";
const POPUP_OVERLAY_ID = "ac-revisit-popup-overlay";
const POPUP_PANEL_ID = "ac-revisit-popup-panel";
const POPUP_TITLE_ID = "ac-revisit-popup-title";
const POPUP_CLOSE_ID = "ac-revisit-popup-close";
const POPUP_TODAY_LINK_ID = "ac-revisit-popup-today-link";
const POPUP_ACTION_ID = "ac-revisit-popup-action";
const POPUP_TRIGGER_ROLE = "trigger";

export interface PopupStateSnapshot {
  readonly source: "menu" | "bootstrap";
  readonly today: LocalDateKey;
  readonly reviewWorkspace: ReviewWorkspace;
  readonly viewModel: PopupViewModel;
}

export type PopupShellPresenter = (input: PopupStateSnapshot) => void;

export type PopupStateLoadError = { readonly kind: "storage_unavailable" };

export type PopupStateLoadInput =
  | {
      readonly mode: "readonly";
      readonly source: "menu" | "bootstrap";
      readonly today: LocalDateKey;
    }
  | {
      readonly mode: "workspace";
      readonly source: "menu" | "bootstrap";
      readonly today: LocalDateKey;
      readonly reviewWorkspace: ReviewWorkspace;
    };

export interface PopupStateLoader {
  load(input: PopupStateLoadInput): Result<PopupStateSnapshot, PopupStateLoadError>;
}

export interface PopupShellRefreshInput {
  readonly source: "menu" | "bootstrap";
  readonly today: LocalDateKey;
}

export interface PopupShellActionInput extends PopupShellRefreshInput {
  readonly action: "complete" | "fetch_next";
  readonly expectedDailyState: DailySuggestionState;
}

export interface PopupShellInteractions {
  readonly getToday?: () => LocalDateKey;
  readonly loadReadonly?: (input: PopupShellRefreshInput) => PopupStateSnapshot | null;
  readonly refreshPopup?: (input: PopupShellRefreshInput) => PopupStateSnapshot | null;
  readonly runPrimaryAction?: (input: PopupShellActionInput) => PopupStateSnapshot | null;
}

export interface PopupStateLoaderDependencies {
  readonly readWorkspace?: () => Result<ReviewWorkspace, PopupStateLoadError>;
  readonly listDueCandidates: (input: {
    readonly today: LocalDateKey;
    readonly reviewItems: readonly ReviewItem[];
  }) => readonly ReviewItem[];
}

export function createPopupStateLoader(
  dependencies: PopupStateLoaderDependencies,
): PopupStateLoader {
  const popupViewModelFactory = createPopupViewModelFactory();

  return {
    load(input) {
      const workspaceResult =
        input.mode === "workspace"
          ? success(input.reviewWorkspace)
          : dependencies.readWorkspace?.() ??
            failure({
              kind: "storage_unavailable",
            });

      if (!workspaceResult.ok) {
        return workspaceResult;
      }

      const reviewWorkspace = workspaceResult.value;
      const hasDueCandidates =
        dependencies.listDueCandidates({
          today: input.today,
          reviewItems: reviewWorkspace.reviewItems,
        }).length > 0;

      return success({
        source: input.source,
        today: input.today,
        reviewWorkspace,
        viewModel: popupViewModelFactory.build({
          reviewItems: reviewWorkspace.reviewItems,
          dailyState: reviewWorkspace.dailyState,
          hasDueCandidates,
        }),
      });
    },
  };
}

export function createPopupShellPresenter(
  documentRef: Document = document,
  interactions: PopupShellInteractions = {},
): PopupShellPresenter {
  const interactionSessionValidator = createInteractionSessionValidator();
  let lastFocusedElement: HTMLElement | null = null;

  const presentPopup: PopupShellPresenter = (input) => {
    let popup = documentRef.getElementById(POPUP_ROOT_ID);

    if (popup === null) {
      popup = documentRef.createElement("section");
      popup.id = POPUP_ROOT_ID;
      popup.tabIndex = -1;
      popup.setAttribute("role", "dialog");
      popup.setAttribute("aria-modal", "true");

      const overlay = documentRef.createElement("div");
      overlay.id = POPUP_OVERLAY_ID;
      popup.append(overlay);

      const panel = documentRef.createElement("div");
      panel.id = POPUP_PANEL_ID;
      popup.append(panel);

      const title = documentRef.createElement("h2");
      title.id = POPUP_TITLE_ID;
      title.textContent = "今日の一問";
      panel.append(title);

      const closeButton = documentRef.createElement("button");
      closeButton.id = POPUP_CLOSE_ID;
      closeButton.type = "button";
      closeButton.textContent = "閉じる";
      panel.append(closeButton);

      const triggerLabel = documentRef.createElement("p");
      triggerLabel.dataset.role = POPUP_TRIGGER_ROLE;
      panel.append(triggerLabel);

      const todayLink = documentRef.createElement("a");
      todayLink.id = POPUP_TODAY_LINK_ID;
      todayLink.setAttribute("href", "#");
      panel.append(todayLink);

      const actionButton = documentRef.createElement("button");
      actionButton.id = POPUP_ACTION_ID;
      actionButton.type = "button";
      panel.append(actionButton);

      documentRef.body.append(popup);
    }

    popup.dataset.source = input.source;
    popup.dataset.status = input.reviewWorkspace.dailyState.status;
    popup.dataset.activeProblemId = input.reviewWorkspace.dailyState.activeProblemId ?? "";
    popup.dataset.lastDailyEvaluatedOn = input.reviewWorkspace.dailyState.lastDailyEvaluatedOn ?? "";
    popup.setAttribute("aria-labelledby", POPUP_TITLE_ID);
    const overlay = popup.querySelector<HTMLDivElement>(`#${POPUP_OVERLAY_ID}`);
    const closeButton = popup.querySelector<HTMLButtonElement>(`#${POPUP_CLOSE_ID}`);
    const triggerLabel = popup.querySelector<HTMLElement>("[data-role='trigger']");
    const todayLink = popup.querySelector<HTMLAnchorElement>(`#${POPUP_TODAY_LINK_ID}`);
    const actionButton = popup.querySelector<HTMLButtonElement>(`#${POPUP_ACTION_ID}`);

    if (
      documentRef.activeElement instanceof HTMLElement &&
      !popup.contains(documentRef.activeElement)
    ) {
      lastFocusedElement = documentRef.activeElement;
    }

    if (triggerLabel !== null) {
      triggerLabel.textContent =
        input.source === "bootstrap"
          ? `${input.today} の自動通知`
          : `${input.today} のメニュー操作`;
    }

    if (todayLink !== null) {
      todayLink.textContent = input.viewModel.todayLinkLabel;

      if (
        input.viewModel.todayLink.enabled &&
        input.reviewWorkspace.dailyState.activeProblemId !== null
      ) {
        todayLink.href = toProblemPath(input.reviewWorkspace.dailyState.activeProblemId);
        todayLink.removeAttribute("aria-disabled");
        todayLink.removeAttribute("data-muted");
      } else {
        todayLink.removeAttribute("href");
        todayLink.setAttribute("aria-disabled", "true");
        todayLink.dataset.muted = "true";
      }
    }

    if (actionButton !== null) {
      actionButton.textContent = input.viewModel.primaryActionLabel;
      actionButton.disabled = !input.viewModel.primaryAction.enabled;
    }

    if (overlay !== null) {
      overlay.onclick = () => {
        dismissPopup(popup);
      };
    }

    if (closeButton !== null) {
      closeButton.onclick = () => {
        dismissPopup(popup);
      };
    }

    if (todayLink !== null) {
      todayLink.onclick = (event) => {
        const interactionState = revalidateInteraction({
          renderedInput: input,
          currentSource: input.source,
        });

        if (interactionState.kind === "stale") {
          event.preventDefault();
        }
      };
    }

    if (actionButton !== null) {
      actionButton.onclick = (event) => {
        event.preventDefault();

        if (!input.viewModel.primaryAction.enabled) {
          return;
        }

        const interactionState = revalidateInteraction({
          renderedInput: input,
          currentSource: input.source,
        });

        if (interactionState.kind === "stale") {
          return;
        }

        const nextPopup = interactions.runPrimaryAction?.({
          action: input.viewModel.primaryActionKind,
          source: interactionState.source,
          today: interactionState.today,
          expectedDailyState: interactionState.currentSnapshot.reviewWorkspace.dailyState,
        });

        if (nextPopup !== null && nextPopup !== undefined) {
          presentPopup(nextPopup);
        }
      };
    }

    popup.onkeydown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        dismissPopup(popup);
      }
    };

    popup.focus();
  };

  return presentPopup;

  function revalidateInteraction({
    renderedInput,
    currentSource,
  }: {
    readonly renderedInput: PopupStateSnapshot;
    readonly currentSource: "menu" | "bootstrap";
  }):
    | {
        readonly kind: "valid";
        readonly currentSnapshot: PopupStateSnapshot;
        readonly source: "menu" | "bootstrap";
        readonly today: LocalDateKey;
      }
    | { readonly kind: "stale" } {
    const today = interactions.getToday?.() ?? renderedInput.today;
    const latestSnapshot =
      interactions.loadReadonly?.({
        source: currentSource,
        today,
      }) ?? renderedInput;

    if (
      interactionSessionValidator.validate({
        expectedDailyState: renderedInput.reviewWorkspace.dailyState,
        actualDailyState: latestSnapshot.reviewWorkspace.dailyState,
        today,
      }).kind === "stale"
    ) {
      const refreshedSnapshot = interactions.refreshPopup?.({
        source: currentSource,
        today,
      });

      if (refreshedSnapshot !== null && refreshedSnapshot !== undefined) {
        presentPopup(refreshedSnapshot);
      }

      return { kind: "stale" };
    }

    return {
      kind: "valid",
      currentSnapshot: latestSnapshot,
      source: currentSource,
      today,
    };
  }

  function dismissPopup(popup: HTMLElement) {
    popup.remove();

    if (lastFocusedElement !== null && documentRef.contains(lastFocusedElement)) {
      lastFocusedElement.focus();
    }

    lastFocusedElement = null;
  }
}

function success<Value>(value: Value): Result<Value, PopupStateLoadError> {
  return {
    ok: true,
    value,
  };
}

function failure(error: PopupStateLoadError): Result<never, PopupStateLoadError> {
  return {
    ok: false,
    error,
  };
}

function toProblemPath(problemId: string): string {
  const [contestId, taskId] = problemId.split("/");

  if (contestId === undefined || taskId === undefined) {
    return "#";
  }

  return `/contests/${contestId}/tasks/${taskId}`;
}
