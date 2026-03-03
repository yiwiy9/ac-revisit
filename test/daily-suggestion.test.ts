import { expect, test } from "vitest";

import { createCandidateSelectionService } from "../src/domain/candidate-selection.ts";
import { createDailySuggestionService } from "../src/domain/daily-suggestion.ts";
import { createLocalDateMath } from "../src/shared/date.ts";
import { createWorkspace } from "./support/workspace-fixtures.ts";
import { createWorkspaceStoreDouble } from "./support/workspace-store-doubles.ts";

test("DailySuggestionService consumes the first daily evaluation and auto-opens on bootstrap when due candidates exist", () => {
  const double = createWorkspaceStoreDouble(
    createWorkspace({
      reviewItems: [
        {
          problemId: "abc100/abc100_a",
          problemTitle: "A - Happy Birthday!",
          registeredOn: "2026-02-16",
        },
        {
          problemId: "abc100/abc100_b",
          problemTitle: "B - Ringo's Favorite Numbers",
          registeredOn: "2026-02-17",
        },
      ],
      dailyState: {
        activeProblemId: "abc100/abc100_b",
        status: "incomplete",
        lastDailyEvaluatedOn: "2026-03-01",
      },
    }),
  );
  const service = createDailySuggestionService({
    reviewStore: double.store,
    localDateMath: createLocalDateMath(),
    candidateSelectionService: createCandidateSelectionService({
      random: () => 0,
    }),
  });

  const result = service.ensureTodaySuggestion({
    today: "2026-03-02",
    trigger: "bootstrap",
  });

  expect(result).toEqual({
    ok: true,
    value: {
      reviewWorkspace: {
        reviewItems: [
          {
            problemId: "abc100/abc100_a",
            problemTitle: "A - Happy Birthday!",
            registeredOn: "2026-02-16",
          },
          {
            problemId: "abc100/abc100_b",
            problemTitle: "B - Ringo's Favorite Numbers",
            registeredOn: "2026-02-17",
          },
        ],
        dailyState: {
          activeProblemId: "abc100/abc100_a",
          status: "incomplete",
          lastDailyEvaluatedOn: "2026-03-02",
        },
      },
      dailyState: {
        activeProblemId: "abc100/abc100_a",
        status: "incomplete",
        lastDailyEvaluatedOn: "2026-03-02",
      },
      shouldAutoOpenPopup: true,
    },
  });
  expect(double.writes).toHaveLength(1);
});

test("DailySuggestionService is a no-op after the day has already been evaluated", () => {
  const workspace = createWorkspace({
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
  });
  const double = createWorkspaceStoreDouble(workspace);
  const service = createDailySuggestionService({
    reviewStore: double.store,
    localDateMath: createLocalDateMath(),
    candidateSelectionService: createCandidateSelectionService({
      random: () => 0.99,
    }),
  });

  const result = service.ensureTodaySuggestion({
    today: "2026-03-02",
    trigger: "menu",
  });

  expect(result).toEqual({
    ok: true,
    value: {
      reviewWorkspace: workspace,
      dailyState: workspace.dailyState,
      shouldAutoOpenPopup: false,
    },
  });
  expect(double.writes).toHaveLength(0);
});

test("DailySuggestionService clears stale prior-day suggestions when no due candidates exist", () => {
  const double = createWorkspaceStoreDouble(
    createWorkspace({
      reviewItems: [
        {
          problemId: "abc100/abc100_a",
          problemTitle: "A - Happy Birthday!",
          registeredOn: "2026-02-18",
        },
      ],
      dailyState: {
        activeProblemId: "abc100/abc100_a",
        status: "incomplete",
        lastDailyEvaluatedOn: "2026-03-01",
      },
    }),
  );
  const service = createDailySuggestionService({
    reviewStore: double.store,
    localDateMath: createLocalDateMath(),
    candidateSelectionService: createCandidateSelectionService({
      random: () => 0,
    }),
  });

  const result = service.ensureTodaySuggestion({
    today: "2026-03-02",
    trigger: "menu",
  });

  expect(result).toEqual({
    ok: true,
    value: {
      reviewWorkspace: {
        reviewItems: [
          {
            problemId: "abc100/abc100_a",
            problemTitle: "A - Happy Birthday!",
            registeredOn: "2026-02-18",
          },
        ],
        dailyState: {
          activeProblemId: null,
          status: "complete",
          lastDailyEvaluatedOn: "2026-03-02",
        },
      },
      dailyState: {
        activeProblemId: null,
        status: "complete",
        lastDailyEvaluatedOn: "2026-03-02",
      },
      shouldAutoOpenPopup: false,
    },
  });
  expect(double.writes).toHaveLength(1);
});

test("DailySuggestionService returns storage_unavailable when persisting the first daily evaluation fails", () => {
  const double = createWorkspaceStoreDouble(
    createWorkspace({
      reviewItems: [
        {
          problemId: "abc100/abc100_a",
          problemTitle: "A - Happy Birthday!",
          registeredOn: "2026-02-16",
        },
      ],
    }),
    { failOnWrite: true },
  );
  const service = createDailySuggestionService({
    reviewStore: double.store,
    localDateMath: createLocalDateMath(),
    candidateSelectionService: createCandidateSelectionService({
      random: () => 0,
    }),
  });

  const result = service.ensureTodaySuggestion({
    today: "2026-03-02",
    trigger: "menu",
  });

  expect(result).toEqual({
    ok: false,
    error: {
      kind: "storage_unavailable",
    },
  });
  expect(double.writes).toHaveLength(1);
});

test("DailySuggestionService suppresses bootstrap auto-open when the persisted snapshot does not keep an active suggestion", () => {
  const double = createWorkspaceStoreDouble(
    createWorkspace({
      reviewItems: [
        {
          problemId: "abc100/abc100_a",
          problemTitle: "A - Happy Birthday!",
          registeredOn: "2026-02-16",
        },
      ],
    }),
    {
      persistedWorkspaceOnWrite: createWorkspace({
        reviewItems: [
          {
            problemId: "abc100/abc100_a",
            problemTitle: "A - Happy Birthday!",
            registeredOn: "2026-02-16",
          },
        ],
        dailyState: {
          activeProblemId: null,
          status: "complete",
          lastDailyEvaluatedOn: "2026-03-02",
        },
      }),
    },
  );
  const service = createDailySuggestionService({
    reviewStore: double.store,
    localDateMath: createLocalDateMath(),
    candidateSelectionService: createCandidateSelectionService({
      random: () => 0,
    }),
  });

  const result = service.ensureTodaySuggestion({
    today: "2026-03-02",
    trigger: "bootstrap",
  });

  expect(result).toEqual({
    ok: true,
    value: {
      reviewWorkspace: {
        reviewItems: [
          {
            problemId: "abc100/abc100_a",
            problemTitle: "A - Happy Birthday!",
            registeredOn: "2026-02-16",
          },
        ],
        dailyState: {
          activeProblemId: null,
          status: "complete",
          lastDailyEvaluatedOn: "2026-03-02",
        },
      },
      dailyState: {
        activeProblemId: null,
        status: "complete",
        lastDailyEvaluatedOn: "2026-03-02",
      },
      shouldAutoOpenPopup: false,
    },
  });
  expect(double.writes).toHaveLength(1);
});
