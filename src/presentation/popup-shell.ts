import type { DailySuggestionState, LocalDateKey } from "../shared/types";

const POPUP_ROOT_ID = "ac-revisit-popup";
const POPUP_TITLE_ID = "ac-revisit-popup-title";

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

      const title = documentRef.createElement("h2");
      title.id = POPUP_TITLE_ID;
      title.textContent = "今日の一問";
      popup.append(title);

      const triggerLabel = documentRef.createElement("p");
      triggerLabel.dataset.role = "trigger";
      popup.append(triggerLabel);

      documentRef.body.append(popup);
    }

    popup.dataset.source = input.source;
    popup.dataset.status = input.dailyState.status;
    popup.dataset.activeProblemId = input.dailyState.activeProblemId ?? "";
    popup.dataset.lastDailyEvaluatedOn = input.dailyState.lastDailyEvaluatedOn ?? "";
    popup.setAttribute("aria-labelledby", POPUP_TITLE_ID);
    const triggerLabel = popup.querySelector<HTMLElement>("[data-role='trigger']");

    if (triggerLabel !== null) {
      triggerLabel.textContent =
        input.source === "bootstrap"
          ? `${input.today} の自動通知`
          : `${input.today} のメニュー操作`;
    }
  };
}
