import { expect, test } from "vitest";

import { createReviewMutationService } from "../src/domain/review-mutation.ts";
import { createWorkspace } from "./support/workspace-fixtures.ts";
import { createWorkspaceStoreDouble } from "./support/workspace-store-doubles.ts";

test("ReviewMutationService registers an untracked problem with today's date", () => {
  const double = createWorkspaceStoreDouble(createWorkspace());
  const service = createReviewMutationService({
    reviewStore: double.store,
  });

  const result = service.registerProblem({
    problemId: "abc100/abc100_a",
    problemTitle: "A - Happy Birthday!",
    today: "2026-03-02",
  });

  expect(result).toEqual({
    ok: true,
    value: {
      reviewWorkspace: {
        reviewItems: [
          {
            problemId: "abc100/abc100_a",
            problemTitle: "A - Happy Birthday!",
            registeredOn: "2026-03-02",
          },
        ],
        dailyState: {
          activeProblemId: null,
          status: "complete",
          lastDailyEvaluatedOn: null,
        },
      },
    },
  });
  expect(double.writes).toHaveLength(1);
});

test("ReviewMutationService keeps existing state unchanged when re-registering an existing problem", () => {
  const workspace = createWorkspace({
    reviewItems: [
      {
        problemId: "abc100/abc100_a",
        problemTitle: "A - Happy Birthday!",
        registeredOn: "2026-02-01",
      },
    ],
  });
  const double = createWorkspaceStoreDouble(workspace);
  const service = createReviewMutationService({
    reviewStore: double.store,
  });

  const result = service.registerProblem({
    problemId: "abc100/abc100_a",
    problemTitle: "A - Replaced Title",
    today: "2026-03-02",
  });

  expect(result).toEqual({
    ok: true,
    value: {
      reviewWorkspace: workspace,
    },
  });
  expect(double.writes).toHaveLength(0);
});

test("ReviewMutationService unregisters today's active suggestion and completes it in one write", () => {
  const double = createWorkspaceStoreDouble(
    createWorkspace({
      reviewItems: [
        {
          problemId: "abc100/abc100_a",
          problemTitle: "A - Happy Birthday!",
          registeredOn: "2026-02-01",
        },
        {
          problemId: "abc100/abc100_b",
          problemTitle: "B - Ringo's Favorite Numbers",
          registeredOn: "2026-02-02",
        },
      ],
      dailyState: {
        activeProblemId: "abc100/abc100_a",
        status: "incomplete",
        lastDailyEvaluatedOn: "2026-03-02",
      },
    }),
  );
  const service = createReviewMutationService({
    reviewStore: double.store,
  });

  const result = service.unregisterProblem({
    problemId: "abc100/abc100_a",
    today: "2026-03-02",
  });

  expect(result).toEqual({
    ok: true,
    value: {
      reviewWorkspace: {
        reviewItems: [
          {
            problemId: "abc100/abc100_b",
            problemTitle: "B - Ringo's Favorite Numbers",
            registeredOn: "2026-02-02",
          },
        ],
        dailyState: {
          activeProblemId: null,
          status: "complete",
          lastDailyEvaluatedOn: "2026-03-02",
        },
      },
    },
  });
  expect(double.writes).toHaveLength(1);
});

test("ReviewMutationService removes a stale active suggestion and normalizes the stale daily state", () => {
  const double = createWorkspaceStoreDouble(
    createWorkspace({
      reviewItems: [
        {
          problemId: "abc100/abc100_a",
          problemTitle: "A - Happy Birthday!",
          registeredOn: "2026-02-01",
        },
        {
          problemId: "abc100/abc100_b",
          problemTitle: "B - Ringo's Favorite Numbers",
          registeredOn: "2026-02-02",
        },
      ],
      dailyState: {
        activeProblemId: "abc100/abc100_a",
        status: "incomplete",
        lastDailyEvaluatedOn: "2026-03-01",
      },
    }),
  );
  const service = createReviewMutationService({
    reviewStore: double.store,
  });

  const result = service.unregisterProblem({
    problemId: "abc100/abc100_a",
    today: "2026-03-02",
  });

  expect(result).toEqual({
    ok: true,
    value: {
      reviewWorkspace: {
        reviewItems: [
          {
            problemId: "abc100/abc100_b",
            problemTitle: "B - Ringo's Favorite Numbers",
            registeredOn: "2026-02-02",
          },
        ],
        dailyState: {
          activeProblemId: null,
          status: "complete",
          lastDailyEvaluatedOn: "2026-03-01",
        },
      },
    },
  });
  expect(double.writes).toHaveLength(1);
});

test("ReviewMutationService completes today's problem by deleting and re-registering it in one write", () => {
  const double = createWorkspaceStoreDouble(
    createWorkspace({
      reviewItems: [
        {
          problemId: "abc100/abc100_a",
          problemTitle: "A - Happy Birthday!",
          registeredOn: "2026-02-01",
        },
        {
          problemId: "abc100/abc100_b",
          problemTitle: "B - Ringo's Favorite Numbers",
          registeredOn: "2026-02-02",
        },
      ],
      dailyState: {
        activeProblemId: "abc100/abc100_a",
        status: "incomplete",
        lastDailyEvaluatedOn: "2026-03-02",
      },
    }),
  );
  const service = createReviewMutationService({
    reviewStore: double.store,
  });

  const result = service.completeTodayProblem({
    today: "2026-03-02",
  });

  expect(result).toEqual({
    ok: true,
    value: {
      reviewWorkspace: {
        reviewItems: [
          {
            problemId: "abc100/abc100_b",
            problemTitle: "B - Ringo's Favorite Numbers",
            registeredOn: "2026-02-02",
          },
          {
            problemId: "abc100/abc100_a",
            problemTitle: "A - Happy Birthday!",
            registeredOn: "2026-03-02",
          },
        ],
        dailyState: {
          activeProblemId: null,
          status: "complete",
          lastDailyEvaluatedOn: "2026-03-02",
        },
      },
    },
  });
  expect(double.writes).toHaveLength(1);
});

test("ReviewMutationService returns storage_unavailable without partial updates when a write fails", () => {
  const initialWorkspace = createWorkspace();
  const double = createWorkspaceStoreDouble(initialWorkspace, { failOnWrite: true });
  const service = createReviewMutationService({
    reviewStore: double.store,
  });

  const result = service.registerProblem({
    problemId: "abc100/abc100_a",
    problemTitle: "A - Happy Birthday!",
    today: "2026-03-02",
  });

  expect(result).toEqual({
    ok: false,
    error: { kind: "storage_unavailable" },
  });
  expect(double.getWorkspace()).toEqual(initialWorkspace);
  expect(double.writes).toHaveLength(1);
});
