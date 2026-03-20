import { expect, test } from "vitest";

import { createCandidateSelectionService } from "../src/domain/candidate-selection.ts";
import { createReviewMutationService } from "../src/domain/review-mutation.ts";
import { createWorkspace } from "./support/workspace-fixtures.ts";
import { createWorkspaceStoreDouble } from "./support/workspace-store-doubles.ts";

test("ReviewMutationService registers an untracked problem with today's date", () => {
  const double = createWorkspaceStoreDouble(createWorkspace());
  const service = createReviewMutationService({
    reviewStore: double.store,
    candidateSelectionService: createCandidateSelectionService({
      random: () => 0,
    }),
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
    candidateSelectionService: createCandidateSelectionService({
      random: () => 0,
    }),
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
    candidateSelectionService: createCandidateSelectionService({
      random: () => 0,
    }),
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
    candidateSelectionService: createCandidateSelectionService({
      random: () => 0,
    }),
  });

  const result = service.completeTodayProblem({
    today: "2026-03-02",
    expectedDailyState: {
      activeProblemId: "abc100/abc100_a",
      status: "incomplete",
      lastDailyEvaluatedOn: "2026-03-02",
    },
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
          activeProblemId: "abc100/abc100_a",
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

test("ReviewMutationService keeps the existing workspace unchanged when the complete transaction write fails", () => {
  const initialWorkspace = createWorkspace({
    reviewItems: [
      {
        problemId: "abc100/abc100_a",
        problemTitle: "A - Happy Birthday!",
        registeredOn: "2026-02-10",
      },
      {
        problemId: "abc100/abc100_b",
        problemTitle: "B - Ringo's Favorite Numbers",
        registeredOn: "2026-02-11",
      },
    ],
    dailyState: {
      activeProblemId: "abc100/abc100_a",
      status: "incomplete",
      lastDailyEvaluatedOn: "2026-03-02",
    },
  });
  const double = createWorkspaceStoreDouble(initialWorkspace, { failOnWrite: true });
  const service = createReviewMutationService({
    reviewStore: double.store,
  });

  const result = service.completeTodayProblem({
    today: "2026-03-02",
    expectedDailyState: {
      activeProblemId: "abc100/abc100_a",
      status: "incomplete",
      lastDailyEvaluatedOn: "2026-03-02",
    },
  });

  expect(result).toEqual({
    ok: false,
    error: { kind: "storage_unavailable" },
  });
  expect(double.getWorkspace()).toEqual(initialWorkspace);
  expect(double.writes).toHaveLength(1);
});

test("ReviewMutationService fetches another due problem only after today's problem is complete", () => {
  const double = createWorkspaceStoreDouble(
    createWorkspace({
      reviewItems: [
        {
          problemId: "abc100/abc100_a",
          problemTitle: "A - Happy Birthday!",
          registeredOn: "2026-03-02",
        },
        {
          problemId: "abc100/abc100_b",
          problemTitle: "B - Ringo's Favorite Numbers",
          registeredOn: "2026-02-10",
        },
        {
          problemId: "abc100/abc100_c",
          problemTitle: "C - Daydream",
          registeredOn: "2026-02-12",
        },
      ],
      dailyState: {
        activeProblemId: null,
        status: "complete",
        lastDailyEvaluatedOn: "2026-03-02",
      },
    }),
  );
  const service = createReviewMutationService({
    reviewStore: double.store,
    candidateSelectionService: createCandidateSelectionService({
      random: () => 0,
    }),
  });

  const result = service.fetchNextTodayProblem({
    today: "2026-03-02",
    expectedDailyState: {
      activeProblemId: null,
      status: "complete",
      lastDailyEvaluatedOn: "2026-03-02",
    },
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
          {
            problemId: "abc100/abc100_b",
            problemTitle: "B - Ringo's Favorite Numbers",
            registeredOn: "2026-02-10",
          },
          {
            problemId: "abc100/abc100_c",
            problemTitle: "C - Daydream",
            registeredOn: "2026-02-12",
          },
        ],
        dailyState: {
          activeProblemId: "abc100/abc100_b",
          status: "incomplete",
          lastDailyEvaluatedOn: "2026-03-02",
        },
      },
    },
  });
  expect(double.writes).toHaveLength(1);
});

test("ReviewMutationService rejects fetch-next requests while today's problem is still incomplete", () => {
  const initialWorkspace = createWorkspace({
    reviewItems: [
      {
        problemId: "abc100/abc100_a",
        problemTitle: "A - Happy Birthday!",
        registeredOn: "2026-02-10",
      },
    ],
    dailyState: {
      activeProblemId: "abc100/abc100_a",
      status: "incomplete",
      lastDailyEvaluatedOn: "2026-03-02",
    },
  });
  const double = createWorkspaceStoreDouble(initialWorkspace);
  const service = createReviewMutationService({
    reviewStore: double.store,
  });

  const result = service.fetchNextTodayProblem({
    today: "2026-03-02",
    expectedDailyState: {
      activeProblemId: "abc100/abc100_a",
      status: "incomplete",
      lastDailyEvaluatedOn: "2026-03-02",
    },
  });

  expect(result).toEqual({
    ok: false,
    error: { kind: "today_problem_incomplete" },
  });
  expect(double.getWorkspace()).toEqual(initialWorkspace);
  expect(double.writes).toHaveLength(0);
});

test("ReviewMutationService returns candidate_unavailable when no due problems remain for fetch-next", () => {
  const initialWorkspace = createWorkspace({
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
  });
  const double = createWorkspaceStoreDouble(initialWorkspace);
  const service = createReviewMutationService({
    reviewStore: double.store,
  });

  const result = service.fetchNextTodayProblem({
    today: "2026-03-02",
    expectedDailyState: {
      activeProblemId: null,
      status: "complete",
      lastDailyEvaluatedOn: "2026-03-02",
    },
  });

  expect(result).toEqual({
    ok: false,
    error: { kind: "candidate_unavailable" },
  });
  expect(double.getWorkspace()).toEqual(initialWorkspace);
  expect(double.writes).toHaveLength(0);
});

test("ReviewMutationService returns stale_session for complete requests from a stale popup state", () => {
  const initialWorkspace = createWorkspace({
    reviewItems: [
      {
        problemId: "abc100/abc100_a",
        problemTitle: "A - Happy Birthday!",
        registeredOn: "2026-02-10",
      },
    ],
    dailyState: {
      activeProblemId: null,
      status: "complete",
      lastDailyEvaluatedOn: "2026-03-02",
    },
  });
  const double = createWorkspaceStoreDouble(initialWorkspace);
  const service = createReviewMutationService({
    reviewStore: double.store,
  });

  const result = service.completeTodayProblem({
    today: "2026-03-02",
    expectedDailyState: {
      activeProblemId: "abc100/abc100_a",
      status: "incomplete",
      lastDailyEvaluatedOn: "2026-03-02",
    },
  });

  expect(result).toEqual({
    ok: false,
    error: { kind: "stale_session" },
  });
  expect(double.getWorkspace()).toEqual(initialWorkspace);
  expect(double.writes).toHaveLength(0);
});

test("ReviewMutationService returns stale_session for fetch-next requests after the day rolls over", () => {
  const initialWorkspace = createWorkspace({
    reviewItems: [
      {
        problemId: "abc100/abc100_a",
        problemTitle: "A - Happy Birthday!",
        registeredOn: "2026-02-10",
      },
    ],
    dailyState: {
      activeProblemId: null,
      status: "complete",
      lastDailyEvaluatedOn: "2026-03-01",
    },
  });
  const double = createWorkspaceStoreDouble(initialWorkspace);
  const service = createReviewMutationService({
    reviewStore: double.store,
  });

  const result = service.fetchNextTodayProblem({
    today: "2026-03-02",
    expectedDailyState: {
      activeProblemId: null,
      status: "complete",
      lastDailyEvaluatedOn: "2026-03-01",
    },
  });

  expect(result).toEqual({
    ok: false,
    error: { kind: "stale_session" },
  });
  expect(double.getWorkspace()).toEqual(initialWorkspace);
  expect(double.writes).toHaveLength(0);
});
