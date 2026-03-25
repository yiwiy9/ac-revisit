import { expect, test } from "vitest";

import { bootstrapUserscript } from "../src/bootstrap/userscript.ts";
import { createReviewStoreAdapter } from "../src/persistence/review-store.ts";
import { authenticatedHeaderHtml } from "./support/dom-fixtures.ts";
import { createMemoryStorageDouble } from "./support/storage-doubles.ts";

const domWindow = globalThis.window;
const domDocument = globalThis.document;

function setDocument(html: string, pathname = "/") {
  domDocument.body.innerHTML = html;
  domWindow.history.replaceState({}, "", pathname);
}

test("bootstrapUserscript uses the injected platform rng for the first daily suggestion", () => {
  const storageDouble = createMemoryStorageDouble();
  const reviewStore = createReviewStoreAdapter(storageDouble.storage);
  const seedResult = reviewStore.writeWorkspace({
    reviewItems: [
      {
        problemId: "abc100/abc100_a",
        problemTitle: "A - Happy Birthday!",
        registeredOn: "2026-02-16",
      },
      {
        problemId: "abc100/abc100_b",
        problemTitle: "B - Ringo's Favorite Numbers",
        registeredOn: "2026-02-10",
      },
    ],
    dailyState: {
      activeProblemId: null,
      status: "complete",
      lastDailyEvaluatedOn: null,
    },
  });

  expect(seedResult.ok).toBe(true);
  setDocument(authenticatedHeaderHtml(), "/contests/abc100");

  bootstrapUserscript({
    getToday: () => "2026-03-02",
    platform: {
      rng: () => 0.99,
      reviewStorage: storageDouble.storage,
      diagnosticSink: () => undefined,
    },
  });

  expect(reviewStore.readWorkspace()).toEqual({
    ok: true,
    value: {
      reviewItems: [
        {
          problemId: "abc100/abc100_a",
          problemTitle: "A - Happy Birthday!",
          registeredOn: "2026-02-16",
        },
        {
          problemId: "abc100/abc100_b",
          problemTitle: "B - Ringo's Favorite Numbers",
          registeredOn: "2026-02-10",
        },
      ],
      dailyState: {
        activeProblemId: "abc100/abc100_b",
        status: "incomplete",
        lastDailyEvaluatedOn: "2026-03-02",
      },
    },
  });
});
