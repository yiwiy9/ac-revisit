import { expect, test } from "vitest";

import { createPopupViewModelFactory } from "../src/presentation/popup-view-model.ts";

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
  expect(viewModel.todayLinkLabel).toBe("問題未選択");
  expect(viewModel.primaryActionKind).toBe("fetch_next");
  expect(viewModel.primaryActionLabel).toBe("もう一問");
  expect(viewModel.primaryAction).toEqual({ enabled: true, presentation: "normal" });
});
