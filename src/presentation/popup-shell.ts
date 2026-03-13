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
const POPUP_HEADER_ID = "ac-revisit-popup-header";
const POPUP_BODY_ID = "ac-revisit-popup-body";
const POPUP_FOOTER_ID = "ac-revisit-popup-footer";
const POPUP_TITLE_ID = "ac-revisit-popup-title";
const POPUP_CLOSE_ID = "ac-revisit-popup-close";
const POPUP_DISMISS_ID = "ac-revisit-popup-dismiss";
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
      popup.style.position = "fixed";
      popup.style.inset = "0";
      popup.style.zIndex = "1050";
      popup.style.overflowY = "auto";
      popup.style.padding = "1rem";
      popup.style.boxSizing = "border-box";

      const overlay = documentRef.createElement("div");
      overlay.id = POPUP_OVERLAY_ID;
      overlay.style.position = "fixed";
      overlay.style.inset = "0";
      overlay.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
      popup.append(overlay);

      const panel = documentRef.createElement("div");
      panel.id = POPUP_PANEL_ID;
      panel.style.position = "relative";
      panel.style.width = "100%";
      panel.style.maxWidth = "37.5rem";
      panel.style.margin = "2rem auto";
      panel.style.boxSizing = "border-box";
      panel.style.border = "1px solid rgba(0, 0, 0, 0.2)";
      panel.style.borderRadius = "0.375rem";
      panel.style.backgroundColor = "#ffffff";
      panel.style.color = "#333333";
      panel.style.boxShadow = "0 0.3125rem 0.9375rem rgba(0, 0, 0, 0.5)";
      panel.style.zIndex = "1";
      popup.append(panel);

      const header = documentRef.createElement("div");
      header.id = POPUP_HEADER_ID;
      header.style.display = "flex";
      header.style.alignItems = "center";
      header.style.justifyContent = "space-between";
      header.style.gap = "0.75rem";
      header.style.padding = "0.9375rem 0.9375rem 0";
      panel.append(header);

      const body = documentRef.createElement("div");
      body.id = POPUP_BODY_ID;
      body.style.padding = "0.9375rem";
      panel.append(body);

      const footer = documentRef.createElement("div");
      footer.id = POPUP_FOOTER_ID;
      footer.style.display = "flex";
      footer.style.justifyContent = "space-between";
      footer.style.alignItems = "center";
      footer.style.gap = "0.75rem";
      footer.style.padding = "0 0.9375rem 0.9375rem";
      panel.append(footer);

      const title = documentRef.createElement("h2");
      title.id = POPUP_TITLE_ID;
      title.textContent = "今日の一問";
      title.style.margin = "0";
      title.style.fontSize = "1.125rem";
      title.style.fontWeight = "600";
      title.style.lineHeight = "1.4";
      header.append(title);

      const closeButton = documentRef.createElement("button");
      closeButton.id = POPUP_CLOSE_ID;
      closeButton.type = "button";
      closeButton.textContent = "×";
      closeButton.setAttribute("aria-label", "閉じる");
      closeButton.style.border = "0";
      closeButton.style.background = "transparent";
      closeButton.style.color = "#777777";
      closeButton.style.fontSize = "1.5rem";
      closeButton.style.lineHeight = "1";
      closeButton.style.padding = "0";
      closeButton.style.cursor = "pointer";
      header.append(closeButton);

      const triggerLabel = documentRef.createElement("p");
      triggerLabel.dataset.role = POPUP_TRIGGER_ROLE;
      triggerLabel.style.margin = "0 0 0.75rem 0";
      triggerLabel.style.fontSize = "0.875rem";
      triggerLabel.style.color = "#777777";
      body.append(triggerLabel);

      const todayLink = documentRef.createElement("a");
      todayLink.id = POPUP_TODAY_LINK_ID;
      todayLink.setAttribute("href", "#");
      todayLink.style.display = "block";
      todayLink.style.minHeight = "2.75rem";
      todayLink.style.wordBreak = "break-word";
      todayLink.style.padding = "0.75rem 0.875rem";
      todayLink.style.border = "1px solid #dddddd";
      todayLink.style.borderRadius = "0.25rem";
      todayLink.style.backgroundColor = "#f9f9f9";
      todayLink.style.lineHeight = "1.5";
      body.append(todayLink);

      const actionButton = documentRef.createElement("button");
      actionButton.id = POPUP_ACTION_ID;
      actionButton.type = "button";
      actionButton.style.minWidth = "7rem";
      actionButton.style.padding = "0.375rem 0.75rem";
      actionButton.style.border = "1px solid transparent";
      actionButton.style.borderRadius = "0.25rem";
      actionButton.style.backgroundColor = "#337ab7";
      actionButton.style.borderColor = "#2e6da4";
      actionButton.style.color = "#ffffff";
      actionButton.style.cursor = "pointer";
      footer.append(actionButton);

      const dismissButton = documentRef.createElement("button");
      dismissButton.id = POPUP_DISMISS_ID;
      dismissButton.type = "button";
      dismissButton.textContent = "閉じる";
      dismissButton.style.padding = "0.375rem 0.75rem";
      dismissButton.style.border = "1px solid #cccccc";
      dismissButton.style.borderRadius = "0.25rem";
      dismissButton.style.backgroundColor = "#ffffff";
      dismissButton.style.color = "#333333";
      dismissButton.style.cursor = "pointer";
      footer.append(dismissButton);

      documentRef.body.append(popup);
    }

    popup.dataset.source = input.source;
    popup.dataset.status = input.reviewWorkspace.dailyState.status;
    popup.dataset.activeProblemId = input.reviewWorkspace.dailyState.activeProblemId ?? "";
    popup.dataset.lastDailyEvaluatedOn = input.reviewWorkspace.dailyState.lastDailyEvaluatedOn ?? "";
    popup.setAttribute("aria-labelledby", POPUP_TITLE_ID);
    const overlay = popup.querySelector<HTMLDivElement>(`#${POPUP_OVERLAY_ID}`);
    const closeButton = popup.querySelector<HTMLButtonElement>(`#${POPUP_CLOSE_ID}`);
    const dismissButton = popup.querySelector<HTMLButtonElement>(`#${POPUP_DISMISS_ID}`);
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
        todayLink.style.color = "#337ab7";
        todayLink.style.pointerEvents = "";
        todayLink.style.textDecoration = "none";
        todayLink.style.backgroundColor = "#ffffff";
        todayLink.style.borderColor = "#d9edf7";
      } else {
        todayLink.removeAttribute("href");
        todayLink.setAttribute("aria-disabled", "true");
        todayLink.dataset.muted = "true";
        todayLink.style.color = "#777777";
        todayLink.style.pointerEvents = "none";
        todayLink.style.textDecoration = "none";
        todayLink.style.backgroundColor = "#f5f5f5";
        todayLink.style.borderColor = "#e5e5e5";
      }
    }

    if (actionButton !== null) {
      actionButton.textContent = input.viewModel.primaryActionLabel;
      actionButton.disabled = !input.viewModel.primaryAction.enabled;
      actionButton.style.backgroundColor = input.viewModel.primaryAction.enabled ? "#337ab7" : "#d9d9d9";
      actionButton.style.borderColor = input.viewModel.primaryAction.enabled ? "#2e6da4" : "#cccccc";
      actionButton.style.color = input.viewModel.primaryAction.enabled ? "#ffffff" : "#666666";
      actionButton.style.cursor = input.viewModel.primaryAction.enabled ? "pointer" : "not-allowed";
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

    if (dismissButton !== null) {
      dismissButton.onclick = () => {
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
    const maybeLatestSnapshot = interactions.loadReadonly?.({
      source: currentSource,
      today,
    });

    if (
      interactions.loadReadonly !== undefined &&
      (maybeLatestSnapshot === null || maybeLatestSnapshot === undefined)
    ) {
      return { kind: "stale" };
    }

    const latestSnapshot = maybeLatestSnapshot ?? renderedInput;

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
