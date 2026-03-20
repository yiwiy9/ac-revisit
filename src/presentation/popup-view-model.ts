import { REVIEW_INTERVAL_DAYS } from "../shared/date";
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
  readonly description: string;
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
      const hasCompletedTodaySuggestion =
        input.dailyState.status === "complete" && input.dailyState.activeProblemId !== null;
      const canFetchNextSuggestion =
        input.dailyState.status === "complete" && input.hasDueCandidates === true;
      const primaryActionKind =
        hasActiveIncompleteSuggestion === true
          ? "complete"
          : hasCompletedTodaySuggestion === true || canFetchNextSuggestion === true
            ? "fetch_next"
            : "complete";
      const primaryActionEnabled =
        hasActiveIncompleteSuggestion === true || canFetchNextSuggestion === true;

      return {
        todayLink: hasActiveIncompleteSuggestion
          ? { enabled: true, presentation: "normal" }
          : { enabled: false, presentation: "grayed" },
        todayLinkLabel: activeReviewItem?.problemTitle ?? "今日の一問はありません",
        description:
          hasActiveIncompleteSuggestion === true
            ? "今日の復習対象です。解き終えたら完了で記録できます。"
            : canFetchNextSuggestion === true
              ? "今日の一問は完了済みです。必要ならもう一問で次に進めます。"
              : hasCompletedTodaySuggestion === true
                ? "今日の一問は完了済みです。次に進める復習対象はありません。"
                : `復習対象がありません。追加した問題は${REVIEW_INTERVAL_DAYS}日後に今日の一問として表示されます。`,
        primaryAction: primaryActionEnabled
          ? { enabled: true, presentation: "normal" }
          : { enabled: false, presentation: "grayed" },
        primaryActionLabel:
          hasActiveIncompleteSuggestion === true
            ? "完了"
            : hasCompletedTodaySuggestion === true || canFetchNextSuggestion === true
              ? "もう一問"
              : "完了",
        primaryActionKind,
      };
    },
  };
}
