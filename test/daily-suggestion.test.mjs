import assert from "node:assert/strict";
import { test } from "vitest";

import { createDailySuggestionService } from "../src/domain/daily-suggestion.ts";
import { createLocalDateMath } from "../src/shared/date.ts";

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

test("DailySuggestionService consumes the first daily evaluation and auto-opens on bootstrap when due candidates exist", () => {
  const double = createStoreDouble(
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
    random: () => 0,
  });

  const result = service.ensureTodaySuggestion({
    today: "2026-03-02",
    trigger: "bootstrap",
  });

  assert.deepEqual(result, {
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
  assert.equal(double.writes.length, 1);
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
  const double = createStoreDouble(workspace);
  const service = createDailySuggestionService({
    reviewStore: double.store,
    localDateMath: createLocalDateMath(),
    random: () => 0.99,
  });

  const result = service.ensureTodaySuggestion({
    today: "2026-03-02",
    trigger: "menu",
  });

  assert.deepEqual(result, {
    ok: true,
    value: {
      reviewWorkspace: workspace,
      dailyState: workspace.dailyState,
      shouldAutoOpenPopup: false,
    },
  });
  assert.equal(double.writes.length, 0);
});

test("DailySuggestionService clears stale prior-day suggestions when no due candidates exist", () => {
  const double = createStoreDouble(
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
    random: () => 0,
  });

  const result = service.ensureTodaySuggestion({
    today: "2026-03-02",
    trigger: "menu",
  });

  assert.deepEqual(result, {
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
  assert.equal(double.writes.length, 1);
});

test("DailySuggestionService returns storage_unavailable when persisting the first daily evaluation fails", () => {
  const double = createStoreDouble(
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
    random: () => 0,
  });

  const result = service.ensureTodaySuggestion({
    today: "2026-03-02",
    trigger: "menu",
  });

  assert.deepEqual(result, {
    ok: false,
    error: {
      kind: "storage_unavailable",
    },
  });
  assert.equal(double.writes.length, 1);
});
