import type { DailySuggestionState, ReviewItem } from "../shared/types";

export interface PopupViewModelInput {
  readonly reviewItems: readonly ReviewItem[];
  readonly dailyState: DailySuggestionState;
  readonly hasDueCandidates: boolean;
}

export interface PopupActionState {
  readonly enabled: boolean;
  readonly presentation: "normal" | "grayed";
}

export interface PopupViewModel {
  readonly todayLink: PopupActionState;
  readonly todayLinkLabel: string;
  readonly primaryAction: PopupActionState;
  readonly primaryActionLabel: "もう一問" | "完了";
  readonly primaryActionKind: "fetch_next" | "complete";
}

export interface PopupViewModelFactory {
  build(input: PopupViewModelInput): PopupViewModel;
}

export function createPopupViewModelFactory(): PopupViewModelFactory {
  return {
    build(input) {
      const activeReviewItem = input.reviewItems.find(
        (item) => item.problemId === input.dailyState.activeProblemId,
      );
      const hasActiveIncompleteSuggestion =
        input.dailyState.status === "incomplete" && input.dailyState.activeProblemId !== null;
      const primaryActionKind = hasActiveIncompleteSuggestion ? "complete" : "fetch_next";
      const primaryActionEnabled =
        primaryActionKind === "complete" ? true : input.hasDueCandidates === true;

      return {
        todayLink: hasActiveIncompleteSuggestion
          ? { enabled: true, presentation: "normal" }
          : { enabled: false, presentation: "grayed" },
        todayLinkLabel: activeReviewItem?.problemTitle ?? "問題未選択",
        primaryAction: primaryActionEnabled
          ? { enabled: true, presentation: "normal" }
          : { enabled: false, presentation: "grayed" },
        primaryActionLabel: primaryActionKind === "complete" ? "完了" : "もう一問",
        primaryActionKind,
      };
    },
  };
}
