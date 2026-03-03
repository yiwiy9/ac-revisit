import type { DailySuggestionState, LocalDateKey, ReviewItem } from "../shared/types";
import { createInteractionSessionValidator } from "../domain/interaction-session";
import { createPopupViewModelFactory } from "./popup-view-model";

const POPUP_ROOT_ID = "ac-revisit-popup-root";
const POPUP_OVERLAY_ID = "ac-revisit-popup-overlay";
const POPUP_PANEL_ID = "ac-revisit-popup-panel";
const POPUP_TITLE_ID = "ac-revisit-popup-title";
const POPUP_TODAY_LINK_ID = "ac-revisit-popup-today-link";
const POPUP_ACTION_ID = "ac-revisit-popup-action";
const POPUP_TRIGGER_ROLE = "trigger";

export interface PopupShellRequest {
  readonly source: "menu" | "bootstrap";
  readonly today: LocalDateKey;
  readonly reviewItems: readonly ReviewItem[];
  readonly dailyState: DailySuggestionState;
  readonly hasDueCandidates?: boolean;
}

export type PopupShellPresenter = (input: PopupShellRequest) => void;

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
  readonly refreshPopup?: (input: PopupShellRefreshInput) => PopupShellRequest | null;
  readonly runPrimaryAction?: (input: PopupShellActionInput) => PopupShellRequest | null;
}

export function createPopupShellPresenter(
  documentRef: Document = document,
  interactions: PopupShellInteractions = {},
): PopupShellPresenter {
  const popupViewModelFactory = createPopupViewModelFactory();
  const interactionSessionValidator = createInteractionSessionValidator();

  const presentPopup: PopupShellPresenter = (input) => {
    let popup = documentRef.getElementById(POPUP_ROOT_ID);

    if (popup === null) {
      popup = documentRef.createElement("section");
      popup.id = POPUP_ROOT_ID;
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
    popup.dataset.status = input.dailyState.status;
    popup.dataset.activeProblemId = input.dailyState.activeProblemId ?? "";
    popup.dataset.lastDailyEvaluatedOn = input.dailyState.lastDailyEvaluatedOn ?? "";
    popup.setAttribute("aria-labelledby", POPUP_TITLE_ID);
    const triggerLabel = popup.querySelector<HTMLElement>("[data-role='trigger']");
    const todayLink = popup.querySelector<HTMLAnchorElement>(`#${POPUP_TODAY_LINK_ID}`);
    const actionButton = popup.querySelector<HTMLButtonElement>(`#${POPUP_ACTION_ID}`);

    if (triggerLabel !== null) {
      triggerLabel.textContent =
        input.source === "bootstrap"
          ? `${input.today} の自動通知`
          : `${input.today} のメニュー操作`;
    }

    const viewModel = popupViewModelFactory.build({
      reviewItems: input.reviewItems,
      dailyState: input.dailyState,
      hasDueCandidates: input.hasDueCandidates ?? false,
    });

    if (todayLink !== null) {
      todayLink.textContent = viewModel.todayLinkLabel;

      if (viewModel.todayLink.enabled && input.dailyState.activeProblemId !== null) {
        todayLink.href = toProblemPath(input.dailyState.activeProblemId);
        todayLink.removeAttribute("aria-disabled");
        todayLink.removeAttribute("data-muted");
      } else {
        todayLink.removeAttribute("href");
        todayLink.setAttribute("aria-disabled", "true");
        todayLink.dataset.muted = "true";
      }
    }

    if (actionButton !== null) {
      actionButton.textContent = viewModel.primaryActionLabel;
      actionButton.disabled = !viewModel.primaryAction.enabled;
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

        if (!viewModel.primaryAction.enabled) {
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
          action: viewModel.primaryActionKind,
          source: interactionState.source,
          today: interactionState.today,
          expectedDailyState: interactionState.currentInput.dailyState,
        });

        if (nextPopup !== null && nextPopup !== undefined) {
          presentPopup(nextPopup);
        }
      };
    }
  };

  return presentPopup;

  function revalidateInteraction({
    renderedInput,
    currentSource,
  }: {
    readonly renderedInput: PopupShellRequest;
    readonly currentSource: "menu" | "bootstrap";
  }):
    | {
        readonly kind: "valid";
        readonly currentInput: PopupShellRequest;
        readonly source: "menu" | "bootstrap";
        readonly today: LocalDateKey;
      }
    | { readonly kind: "stale" } {
    const today = interactions.getToday?.() ?? renderedInput.today;
    const latestInput =
      interactions.refreshPopup?.({
        source: currentSource,
        today,
      }) ?? renderedInput;

    if (
      interactionSessionValidator.validate({
        expectedDailyState: renderedInput.dailyState,
        actualDailyState: latestInput.dailyState,
        today,
      }).kind === "stale"
    ) {
      if (latestInput !== renderedInput) {
        presentPopup(latestInput);
      }

      return { kind: "stale" };
    }

    return {
      kind: "valid",
      currentInput: latestInput,
      source: currentSource,
      today,
    };
  }
}

function toProblemPath(problemId: string): string {
  const [contestId, taskId] = problemId.split("/");

  if (contestId === undefined || taskId === undefined) {
    return "#";
  }

  return `/contests/${contestId}/tasks/${taskId}`;
}
