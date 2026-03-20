import { expect, test } from "vitest";

import { createPopupViewModelFactory } from "../src/presentation/popup-view-model.ts";
import { REVIEW_INTERVAL_DAYS } from "../src/shared/date.ts";

const popupViewModelFactory = createPopupViewModelFactory();

test("PopupViewModelFactory enables the today link and complete action for an incomplete active suggestion", () => {
  const viewModel = popupViewModelFactory.build({
    reviewItems: [
      {
        problemId: "abc100/abc100_a",
        problemTitle: "A - Happy Birthday!",
        registeredOn: "2026-02-16",
      },
    ],
    dailyState: {
      activeProblemId: "abc100/abc100_a",
      status: "incomplete",
      lastDailyEvaluatedOn: "2026-03-02",
    },
    hasDueCandidates: true,
  });

  expect(viewModel.todayLink).toEqual({ enabled: true, presentation: "normal" });
  expect(viewModel.todayLinkLabel).toBe("A - Happy Birthday!");
  expect(viewModel.description).toBe("今日の復習対象です。解き終えたら完了で記録できます。");
  expect(viewModel.primaryActionKind).toBe("complete");
  expect(viewModel.primaryActionLabel).toBe("完了");
  expect(viewModel.primaryAction).toEqual({ enabled: true, presentation: "normal" });
});

test("PopupViewModelFactory grays out the link and next action when no due candidates remain", () => {
  const viewModel = popupViewModelFactory.build({
    reviewItems: [
      {
        problemId: "abc100/abc100_a",
        problemTitle: "A - Happy Birthday!",
        registeredOn: "2026-02-16",
      },
    ],
    dailyState: {
      activeProblemId: "abc100/abc100_a",
      status: "complete",
      lastDailyEvaluatedOn: "2026-03-02",
    },
    hasDueCandidates: false,
  });

  expect(viewModel.todayLink).toEqual({ enabled: false, presentation: "grayed" });
  expect(viewModel.todayLinkLabel).toBe("A - Happy Birthday!");
  expect(viewModel.description).toBe("今日の一問は完了済みです。次に進める復習対象はありません。");
  expect(viewModel.primaryActionKind).toBe("fetch_next");
  expect(viewModel.primaryActionLabel).toBe("もう一問");
  expect(viewModel.primaryAction).toEqual({ enabled: false, presentation: "grayed" });
});

test("PopupViewModelFactory enables fetch next and falls back to a neutral label when no matching item exists", () => {
  const viewModel = popupViewModelFactory.build({
    reviewItems: [],
    dailyState: {
      activeProblemId: "abc100/abc100_a",
      status: "complete",
      lastDailyEvaluatedOn: "2026-03-02",
    },
    hasDueCandidates: true,
  });

  expect(viewModel.todayLink).toEqual({ enabled: false, presentation: "grayed" });
  expect(viewModel.todayLinkLabel).toBe("今日の一問はありません");
  expect(viewModel.description).toBe("今日の一問は完了済みです。必要ならもう一問で次に進めます。");
  expect(viewModel.primaryActionKind).toBe("fetch_next");
  expect(viewModel.primaryActionLabel).toBe("もう一問");
  expect(viewModel.primaryAction).toEqual({ enabled: true, presentation: "normal" });
});

test("PopupViewModelFactory disables complete when neither today's suggestion nor due candidates exist", () => {
  const viewModel = popupViewModelFactory.build({
    reviewItems: [],
    dailyState: {
      activeProblemId: null,
      status: "complete",
      lastDailyEvaluatedOn: "2026-03-02",
    },
    hasDueCandidates: false,
  });

  expect(viewModel.todayLink).toEqual({ enabled: false, presentation: "grayed" });
  expect(viewModel.todayLinkLabel).toBe("今日の一問はありません");
  expect(viewModel.description).toBe(
    `復習対象がありません。追加した問題は${REVIEW_INTERVAL_DAYS}日後に今日の一問として表示されます。`,
  );
  expect(viewModel.primaryActionKind).toBe("complete");
  expect(viewModel.primaryActionLabel).toBe("完了");
  expect(viewModel.primaryAction).toEqual({ enabled: false, presentation: "grayed" });
});
