import { createInteractionSessionValidator } from "../domain/interaction-session";
import type {
  DailySuggestionState,
  LocalDateKey,
  Result,
  ReviewItem,
  ReviewWorkspace,
} from "../shared/types";
import { createPopupViewModelFactory, type PopupViewModel } from "./popup-view-model";

const POPUP_ROOT_ID = "ac-revisit-popup-root";
const POPUP_OVERLAY_ID = "ac-revisit-popup-overlay";
const POPUP_PANEL_ID = "ac-revisit-popup-panel";
const POPUP_HEADER_ID = "ac-revisit-popup-header";
const POPUP_BODY_ID = "ac-revisit-popup-body";
const POPUP_FOOTER_ID = "ac-revisit-popup-footer";
const POPUP_TITLE_ID = "ac-revisit-popup-title";
const POPUP_SECTION_TITLE_ID = "ac-revisit-popup-section-title";
const POPUP_DESCRIPTION_ID = "ac-revisit-popup-description";
const POPUP_CLOSE_ID = "ac-revisit-popup-close";
const POPUP_DISMISS_ID = "ac-revisit-popup-dismiss";
const POPUP_TODAY_LINK_ID = "ac-revisit-popup-today-link";
const POPUP_ACTION_ID = "ac-revisit-popup-action";

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
          : (dependencies.readWorkspace?.() ??
            failure({
              kind: "storage_unavailable",
            }));

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
  let previousBodyPaddingRight: string | null = null;

  const presentPopup: PopupShellPresenter = (input) => {
    let popup = documentRef.getElementById(POPUP_ROOT_ID);

    if (popup === null) {
      popup = documentRef.createElement("section");
      popup.id = POPUP_ROOT_ID;
      popup.tabIndex = -1;
      popup.setAttribute("role", "dialog");
      popup.setAttribute("aria-modal", "true");
      popup.className = "modal fade";
      popup.style.display = "none";
      popup.style.paddingRight = "12px";

      const panel = documentRef.createElement("div");
      panel.id = POPUP_PANEL_ID;
      panel.className = "modal-dialog";
      panel.setAttribute("role", "document");
      popup.append(panel);

      const content = documentRef.createElement("div");
      content.className = "modal-content";
      panel.append(content);

      const header = documentRef.createElement("div");
      header.id = POPUP_HEADER_ID;
      header.className = "modal-header";
      content.append(header);

      const body = documentRef.createElement("div");
      body.id = POPUP_BODY_ID;
      body.className = "modal-body";
      content.append(body);

      const footer = documentRef.createElement("div");
      footer.id = POPUP_FOOTER_ID;
      footer.className = "modal-footer";
      content.append(footer);

      const overlay = documentRef.createElement("div");
      overlay.id = POPUP_OVERLAY_ID;
      overlay.className = "modal-backdrop fade";

      const title = documentRef.createElement("h4");
      title.id = POPUP_TITLE_ID;
      title.textContent = "ac-revisit";
      title.className = "modal-title";

      const closeButton = documentRef.createElement("button");
      closeButton.id = POPUP_CLOSE_ID;
      closeButton.type = "button";
      closeButton.className = "close";
      closeButton.setAttribute("aria-label", "閉じる");
      closeButton.setAttribute("data-dismiss", "modal");
      const closeMark = documentRef.createElement("span");
      closeMark.setAttribute("aria-hidden", "true");
      closeMark.textContent = "×";
      closeButton.append(closeMark);
      header.append(closeButton);
      header.append(title);

      const sectionTitle = documentRef.createElement("h3");
      sectionTitle.id = POPUP_SECTION_TITLE_ID;
      sectionTitle.textContent = "今日の一問";
      sectionTitle.className = "h5";
      sectionTitle.style.marginTop = "0";
      sectionTitle.style.marginBottom = "0.375rem";
      body.append(sectionTitle);

      const description = documentRef.createElement("p");
      description.id = POPUP_DESCRIPTION_ID;
      description.textContent = "解く問題がある日は完了、終わった日はもう一問で次へ進めます。";
      description.className = "small text-muted";
      description.style.marginTop = "0";
      description.style.marginBottom = "1.25rem";
      body.append(description);

      const todayLink = documentRef.createElement("a");
      todayLink.id = POPUP_TODAY_LINK_ID;
      todayLink.className = "";
      todayLink.setAttribute("href", "#");
      todayLink.style.whiteSpace = "normal";
      todayLink.style.wordBreak = "break-word";
      todayLink.style.display = "inline-block";
      todayLink.style.marginTop = "0";
      todayLink.style.marginBottom = "1.25rem";
      todayLink.style.lineHeight = "1.4";
      body.append(todayLink);

      const actionButton = documentRef.createElement("button");
      actionButton.id = POPUP_ACTION_ID;
      actionButton.type = "button";
      actionButton.className = "btn btn-primary";
      actionButton.style.display = "block";
      body.append(actionButton);

      const dismissButton = documentRef.createElement("button");
      dismissButton.id = POPUP_DISMISS_ID;
      dismissButton.type = "button";
      dismissButton.textContent = "close";
      dismissButton.className = "btn btn-default";
      dismissButton.setAttribute("data-dismiss", "modal");
      footer.append(dismissButton);

      documentRef.body.append(popup);
      documentRef.body.append(overlay);
    }

    popup.dataset.source = input.source;
    popup.dataset.status = input.reviewWorkspace.dailyState.status;
    popup.dataset.activeProblemId = input.reviewWorkspace.dailyState.activeProblemId ?? "";
    popup.dataset.lastDailyEvaluatedOn =
      input.reviewWorkspace.dailyState.lastDailyEvaluatedOn ?? "";
    popup.dataset.state = "open";
    popup.setAttribute("aria-labelledby", POPUP_TITLE_ID);
    const overlay = documentRef.getElementById(POPUP_OVERLAY_ID);
    const closeButton = popup.querySelector<HTMLButtonElement>(`#${POPUP_CLOSE_ID}`);
    const dismissButton = popup.querySelector<HTMLButtonElement>(`#${POPUP_DISMISS_ID}`);
    const description = popup.querySelector<HTMLParagraphElement>(`#${POPUP_DESCRIPTION_ID}`);
    const todayLink = popup.querySelector<HTMLAnchorElement>(`#${POPUP_TODAY_LINK_ID}`);
    const actionButton = popup.querySelector<HTMLButtonElement>(`#${POPUP_ACTION_ID}`);

    if (
      documentRef.activeElement instanceof HTMLElement &&
      !popup.contains(documentRef.activeElement)
    ) {
      lastFocusedElement = documentRef.activeElement;
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
        todayLink.className = "";
        todayLink.style.pointerEvents = "";
        todayLink.style.color = "";
      } else {
        todayLink.removeAttribute("href");
        todayLink.setAttribute("aria-disabled", "true");
        todayLink.dataset.muted = "true";
        todayLink.className = "text-muted";
        todayLink.style.pointerEvents = "none";
        todayLink.style.color = "#777777";
      }
    }

    if (description !== null) {
      description.textContent = input.viewModel.description;
    }

    if (actionButton !== null) {
      actionButton.textContent = input.viewModel.primaryActionLabel;
      actionButton.disabled = !input.viewModel.primaryAction.enabled;
      if (input.viewModel.primaryAction.enabled) {
        actionButton.className = "btn btn-primary";
      } else {
        actionButton.className = "btn btn-default";
      }
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

    showModal(popup, overlay);
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
    if (popup.dataset.state === "closing") {
      return;
    }

    popup.dataset.state = "closing";
    const overlay = documentRef.getElementById(POPUP_OVERLAY_ID);
    popup.classList.remove("in");
    overlay?.classList.remove("in");

    const removePopup = () => {
      if (popup.isConnected) {
        popup.remove();
      }
      overlay?.remove();
      popup.style.display = "none";
      unlockPageScroll();

      if (lastFocusedElement !== null && documentRef.contains(lastFocusedElement)) {
        lastFocusedElement.focus();
      }

      lastFocusedElement = null;
    };

    const timerHost = documentRef.defaultView ?? window;
    timerHost.setTimeout(removePopup, 300);
  }

  function showModal(popup: HTMLElement, overlay: HTMLElement | null) {
    popup.style.display = "block";
    popup.classList.remove("in");
    overlay?.classList.remove("in");
    lockPageScroll();
    void popup.offsetWidth;
    popup.classList.add("in");
    overlay?.classList.add("in");
  }

  function lockPageScroll() {
    if (!documentRef.body.classList.contains("modal-open")) {
      documentRef.body.classList.add("modal-open");
      previousBodyPaddingRight = documentRef.body.style.paddingRight;
    }
    documentRef.body.style.paddingRight = "12px";
  }

  function unlockPageScroll() {
    documentRef.body.classList.remove("modal-open");
    documentRef.body.style.paddingRight = previousBodyPaddingRight ?? "";
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
