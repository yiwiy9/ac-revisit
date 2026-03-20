import { expect, test } from "vitest";

import {
  REVIEW_STORE_KEY,
  createCanonicalReviewWorkspace,
  createReviewStoreAdapter,
} from "../src/persistence/review-store.ts";
import { createMemoryStorageDouble } from "./support/storage-doubles.ts";

test("ReviewStoreAdapter returns the canonical empty workspace when storage is empty", () => {
  const double = createMemoryStorageDouble();
  const adapter = createReviewStoreAdapter(double.storage);

  const result = adapter.readWorkspace();

  expect(result).toEqual({
    ok: true,
    value: createCanonicalReviewWorkspace(),
  });
  expect(double.reads).toEqual([REVIEW_STORE_KEY]);
});

test("ReviewStoreAdapter falls back to the canonical empty workspace on schema mismatch", () => {
  const double = createMemoryStorageDouble({
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

  expect(result).toEqual({
    ok: true,
    value: createCanonicalReviewWorkspace(),
  });
});

test("ReviewStoreAdapter falls back to the canonical empty workspace on logical inconsistency", () => {
  const double = createMemoryStorageDouble({
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

  expect(result).toEqual({
    ok: true,
    value: createCanonicalReviewWorkspace(),
  });
});

test("ReviewStoreAdapter falls back to the canonical empty workspace when persisted review items contain duplicate problem IDs", () => {
  const double = createMemoryStorageDouble({
    initialValue: JSON.stringify({
      version: 1,
      payload: {
        reviewItems: [
          {
            problemId: "abc100/abc100_a",
            problemTitle: "A - Happy Birthday!",
            registeredOn: "2026-02-01",
          },
          {
            problemId: "abc100/abc100_a",
            problemTitle: "A - Duplicate",
            registeredOn: "2026-02-02",
          },
        ],
        dailyState: {
          activeProblemId: null,
          status: "complete",
          lastDailyEvaluatedOn: "2026-03-02",
        },
      },
    }),
  });
  const adapter = createReviewStoreAdapter(double.storage);

  const result = adapter.readWorkspace();

  expect(result).toEqual({
    ok: true,
    value: createCanonicalReviewWorkspace(),
  });
});

test("ReviewStoreAdapter returns storage_unavailable when reading fails", () => {
  const double = createMemoryStorageDouble({ failOnRead: true });
  const adapter = createReviewStoreAdapter(double.storage);

  const result = adapter.readWorkspace();

  expect(result).toEqual({
    ok: false,
    error: { kind: "storage_unavailable" },
  });
});

test("ReviewStoreAdapter writes a single normalized snapshot with only the allowed fields", () => {
  const double = createMemoryStorageDouble();
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
  } as unknown as Parameters<typeof adapter.writeWorkspace>[0]);

  expect(result).toEqual({
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
  expect(double.writes).toHaveLength(1);
  expect(double.writes[0].key).toBe(REVIEW_STORE_KEY);
  expect(JSON.parse(double.writes[0].value)).toEqual({
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

test("ReviewStoreAdapter preserves the completed problem ID when complete state still points at a visible title", () => {
  const double = createMemoryStorageDouble();
  const adapter = createReviewStoreAdapter(double.storage);

  const result = adapter.writeWorkspace({
    reviewItems: [
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
  });

  expect(result).toEqual({
    ok: true,
    value: {
      reviewItems: [
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
  });
  expect(JSON.parse(double.writes[0].value)).toEqual({
    version: 1,
    payload: result.value,
  });
});

test("ReviewStoreAdapter falls back to the canonical empty workspace when write input is logically inconsistent", () => {
  const double = createMemoryStorageDouble();
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
  } as unknown as Parameters<typeof adapter.writeWorkspace>[0]);

  expect(result).toEqual({
    ok: true,
    value: createCanonicalReviewWorkspace(),
  });
  expect(JSON.parse(double.writes[0].value)).toEqual({
    version: 1,
    payload: createCanonicalReviewWorkspace(),
  });
});

test("ReviewStoreAdapter returns storage_unavailable when writing fails without retrying", () => {
  const double = createMemoryStorageDouble({ failOnWrite: true });
  const adapter = createReviewStoreAdapter(double.storage);

  const result = adapter.writeWorkspace(createCanonicalReviewWorkspace());

  expect(result).toEqual({
    ok: false,
    error: { kind: "storage_unavailable" },
  });
  expect(double.writes).toHaveLength(1);
});

test("ReviewStoreAdapter uses one shared workspace key without account-specific namespacing", () => {
  const double = createMemoryStorageDouble();
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

  expect(double.writes.map((entry) => entry.key)).toEqual([REVIEW_STORE_KEY]);
  expect(double.reads).toEqual([REVIEW_STORE_KEY]);
});

test("ReviewStoreAdapter follows last-write-wins when the same browser profile writes twice", () => {
  const double = createMemoryStorageDouble();
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

  expect(firstResult.ok).toBe(true);
  expect(secondResult).toEqual({
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
  expect(readBack).toEqual(secondResult);
  expect(double.writes).toHaveLength(2);
});
