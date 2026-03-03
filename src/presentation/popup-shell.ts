import type { DailySuggestionState, LocalDateKey } from "../shared/types";

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
  readonly dailyState: DailySuggestionState;
}

export type PopupShellPresenter = (input: PopupShellRequest) => void;

export function createPopupShellPresenter(
  documentRef: Document = document,
): PopupShellPresenter {
  return (input) => {
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

    if (todayLink !== null) {
      todayLink.textContent =
        input.dailyState.activeProblemId === null
          ? "提案中の問題はありません"
          : input.dailyState.activeProblemId;
    }

    if (actionButton !== null) {
      actionButton.textContent = "更新";
    }
  };
}
