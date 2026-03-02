import assert from "node:assert/strict";
import { test } from "vitest";

import { createReviewMutationService } from "../src/domain/review-mutation.ts";

function createStoreDouble(workspace, { failOnRead = false, failOnWrite = false } = {}) {
  let currentWorkspace = workspace;
  const writes = [];

  return {
    store: {
      readWorkspace() {
        if (failOnRead) {
          return { ok: false, error: { kind: "storage_unavailable" } };
        }

        return { ok: true, value: currentWorkspace };
      },
      writeWorkspace(nextWorkspace) {
        writes.push(nextWorkspace);

        if (failOnWrite) {
          return { ok: false, error: { kind: "storage_unavailable" } };
        }

        currentWorkspace = nextWorkspace;
        return { ok: true, value: nextWorkspace };
      },
    },
    writes,
    getWorkspace() {
      return currentWorkspace;
    },
  };
}

function createWorkspace(overrides = {}) {
  return {
    reviewItems: [],
    dailyState: {
      activeProblemId: null,
      status: "complete",
      lastDailyEvaluatedOn: null,
    },
    ...overrides,
  };
}

test("ReviewMutationService registers an untracked problem with today's date", () => {
  const double = createStoreDouble(createWorkspace());
  const service = createReviewMutationService({
    reviewStore: double.store,
  });

  const result = service.registerProblem({
    problemId: "abc100/abc100_a",
    problemTitle: "A - Happy Birthday!",
    today: "2026-03-02",
  });

  assert.deepEqual(result, {
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
  assert.equal(double.writes.length, 1);
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
  const double = createStoreDouble(workspace);
  const service = createReviewMutationService({
    reviewStore: double.store,
  });

  const result = service.registerProblem({
    problemId: "abc100/abc100_a",
    problemTitle: "A - Replaced Title",
    today: "2026-03-02",
  });

  assert.deepEqual(result, {
    ok: true,
    value: {
      reviewWorkspace: workspace,
    },
  });
  assert.equal(double.writes.length, 0);
});

test("ReviewMutationService unregisters today's active suggestion and completes it in one write", () => {
  const double = createStoreDouble(
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

  assert.deepEqual(result, {
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
  assert.equal(double.writes.length, 1);
});

test("ReviewMutationService removes a stale active suggestion and normalizes the stale daily state", () => {
  const double = createStoreDouble(
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

  assert.deepEqual(result, {
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
  assert.equal(double.writes.length, 1);
});

test("ReviewMutationService completes today's problem by deleting and re-registering it in one write", () => {
  const double = createStoreDouble(
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

  assert.deepEqual(result, {
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
  assert.equal(double.writes.length, 1);
});

test("ReviewMutationService returns storage_unavailable without partial updates when a write fails", () => {
  const initialWorkspace = createWorkspace();
  const double = createStoreDouble(initialWorkspace, { failOnWrite: true });
  const service = createReviewMutationService({
    reviewStore: double.store,
  });

  const result = service.registerProblem({
    problemId: "abc100/abc100_a",
    problemTitle: "A - Happy Birthday!",
    today: "2026-03-02",
  });

  assert.deepEqual(result, {
    ok: false,
    error: { kind: "storage_unavailable" },
  });
  assert.deepEqual(double.getWorkspace(), initialWorkspace);
  assert.equal(double.writes.length, 1);
});
