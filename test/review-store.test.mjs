import assert from "node:assert/strict";
import { test } from "vitest";

import {
  REVIEW_STORE_KEY,
  createCanonicalReviewWorkspace,
  createReviewStoreAdapter,
} from "../src/persistence/review-store.ts";

function createStorageDouble({ initialValue = null, failOnRead = false, failOnWrite = false } = {}) {
  let storedValue = initialValue;
  const reads = [];
  const writes = [];

  return {
    storage: {
      get(key) {
        reads.push(key);

        if (failOnRead) {
          throw new Error("read failed");
        }

        return storedValue;
      },
      set(key, value) {
        writes.push({ key, value });

        if (failOnWrite) {
          throw new Error("write failed");
        }

        storedValue = value;
      },
    },
    reads,
    writes,
    getStoredValue() {
      return storedValue;
    },
  };
}

test("ReviewStoreAdapter returns the canonical empty workspace when storage is empty", () => {
  const double = createStorageDouble();
  const adapter = createReviewStoreAdapter(double.storage);

  const result = adapter.readWorkspace();

  assert.deepEqual(result, {
    ok: true,
    value: createCanonicalReviewWorkspace(),
  });
  assert.deepEqual(double.reads, [REVIEW_STORE_KEY]);
});

test("ReviewStoreAdapter falls back to the canonical empty workspace on schema mismatch", () => {
  const double = createStorageDouble({
    initialValue: JSON.stringify({
      version: 2,
      payload: {
        reviewItems: [
          {
            problemId: "abc100/abc100_a",
            problemTitle: "A - Happy Birthday!",
            registeredOn: "2026-02-01",
          },
        ],
        dailyState: {
          activeProblemId: null,
          status: "complete",
          lastDailyEvaluatedOn: null,
        },
      },
    }),
  });
  const adapter = createReviewStoreAdapter(double.storage);

  const result = adapter.readWorkspace();

  assert.deepEqual(result, {
    ok: true,
    value: createCanonicalReviewWorkspace(),
  });
});

test("ReviewStoreAdapter falls back to the canonical empty workspace on logical inconsistency", () => {
  const double = createStorageDouble({
    initialValue: JSON.stringify({
      version: 1,
      payload: {
        reviewItems: [
          {
            problemId: "abc100/abc100_a",
            problemTitle: "A - Happy Birthday!",
            registeredOn: "2026-02-01",
          },
        ],
        dailyState: {
          activeProblemId: "abc100/abc100_b",
          status: "incomplete",
          lastDailyEvaluatedOn: "2026-03-02",
        },
      },
    }),
  });
  const adapter = createReviewStoreAdapter(double.storage);

  const result = adapter.readWorkspace();

  assert.deepEqual(result, {
    ok: true,
    value: createCanonicalReviewWorkspace(),
  });
});

test("ReviewStoreAdapter returns storage_unavailable when reading fails", () => {
  const double = createStorageDouble({ failOnRead: true });
  const adapter = createReviewStoreAdapter(double.storage);

  const result = adapter.readWorkspace();

  assert.deepEqual(result, {
    ok: false,
    error: { kind: "storage_unavailable" },
  });
});

test("ReviewStoreAdapter writes a single normalized snapshot with only the allowed fields", () => {
  const double = createStorageDouble();
  const adapter = createReviewStoreAdapter(double.storage);

  const result = adapter.writeWorkspace({
    reviewItems: [
      {
        problemId: "abc100/abc100_b",
        problemTitle: "B - Ringo's Favorite Numbers",
        registeredOn: "2026-02-02",
        note: "must not persist",
      },
      {
        problemId: "abc100/abc100_a",
        problemTitle: "A - Happy Birthday!",
        registeredOn: "2026-02-01",
        tags: ["easy"],
      },
    ],
    dailyState: {
      activeProblemId: null,
      status: "complete",
      lastDailyEvaluatedOn: "2026-03-02",
      extra: true,
    },
    extraTopLevel: "ignored",
  });

  assert.deepEqual(result, {
    ok: true,
    value: {
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
        activeProblemId: null,
        status: "complete",
        lastDailyEvaluatedOn: "2026-03-02",
      },
    },
  });
  assert.equal(double.writes.length, 1);
  assert.equal(double.writes[0].key, REVIEW_STORE_KEY);
  assert.deepEqual(JSON.parse(double.writes[0].value), {
    version: 1,
    payload: {
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
        activeProblemId: null,
        status: "complete",
        lastDailyEvaluatedOn: "2026-03-02",
      },
    },
  });
});

test("ReviewStoreAdapter falls back to the canonical empty workspace when write input is logically inconsistent", () => {
  const double = createStorageDouble();
  const adapter = createReviewStoreAdapter(double.storage);

  const result = adapter.writeWorkspace({
    reviewItems: [
      {
        problemId: "abc100/abc100_a",
        problemTitle: "A - Happy Birthday!",
        registeredOn: "2026-02-01",
      },
    ],
    dailyState: {
      activeProblemId: "abc100/abc100_b",
      status: "incomplete",
      lastDailyEvaluatedOn: "2026-03-02",
    },
  });

  assert.deepEqual(result, {
    ok: true,
    value: createCanonicalReviewWorkspace(),
  });
  assert.deepEqual(JSON.parse(double.writes[0].value), {
    version: 1,
    payload: createCanonicalReviewWorkspace(),
  });
});

test("ReviewStoreAdapter returns storage_unavailable when writing fails without retrying", () => {
  const double = createStorageDouble({ failOnWrite: true });
  const adapter = createReviewStoreAdapter(double.storage);

  const result = adapter.writeWorkspace(createCanonicalReviewWorkspace());

  assert.deepEqual(result, {
    ok: false,
    error: { kind: "storage_unavailable" },
  });
  assert.equal(double.writes.length, 1);
});

test("ReviewStoreAdapter uses one shared workspace key without account-specific namespacing", () => {
  const double = createStorageDouble();
  const adapter = createReviewStoreAdapter(double.storage);

  adapter.writeWorkspace({
    reviewItems: [
      {
        problemId: "abc100/abc100_a",
        problemTitle: "A - Happy Birthday!",
        registeredOn: "2026-02-01",
      },
    ],
    dailyState: {
      activeProblemId: null,
      status: "complete",
      lastDailyEvaluatedOn: null,
    },
  });
  adapter.readWorkspace();

  assert.deepEqual(double.writes.map((entry) => entry.key), [REVIEW_STORE_KEY]);
  assert.deepEqual(double.reads, [REVIEW_STORE_KEY]);
});

test("ReviewStoreAdapter follows last-write-wins when the same browser profile writes twice", () => {
  const double = createStorageDouble();
  const adapter = createReviewStoreAdapter(double.storage);

  const firstResult = adapter.writeWorkspace({
    reviewItems: [
      {
        problemId: "abc100/abc100_a",
        problemTitle: "A - Happy Birthday!",
        registeredOn: "2026-02-01",
      },
    ],
    dailyState: {
      activeProblemId: null,
      status: "complete",
      lastDailyEvaluatedOn: "2026-03-01",
    },
  });
  const secondResult = adapter.writeWorkspace({
    reviewItems: [
      {
        problemId: "abc200/abc200_a",
        problemTitle: "A - Century",
        registeredOn: "2026-02-02",
      },
    ],
    dailyState: {
      activeProblemId: "abc200/abc200_a",
      status: "incomplete",
      lastDailyEvaluatedOn: "2026-03-02",
    },
  });
  const readBack = adapter.readWorkspace();

  assert.equal(firstResult.ok, true);
  assert.deepEqual(secondResult, {
    ok: true,
    value: {
      reviewItems: [
        {
          problemId: "abc200/abc200_a",
          problemTitle: "A - Century",
          registeredOn: "2026-02-02",
        },
      ],
      dailyState: {
        activeProblemId: "abc200/abc200_a",
        status: "incomplete",
        lastDailyEvaluatedOn: "2026-03-02",
      },
    },
  });
  assert.deepEqual(readBack, secondResult);
  assert.equal(double.writes.length, 2);
});
