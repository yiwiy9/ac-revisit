import { beforeEach, describe, expect, test } from "vitest";

import { bootstrapUserscript } from "../src/main.ts";
import { createReviewStoreAdapter } from "../src/persistence/review-store.ts";
import type { PopupRequest } from "../src/main.ts";
import type { ReviewStorePort } from "../src/persistence/review-store.ts";
import type { ReviewWorkspace } from "../src/shared/types.ts";
import {
  anonymousHeaderHtml,
  authenticatedHeaderHtml,
  authenticatedProblemPageHtml,
} from "./support/dom-fixtures.ts";
import { createMemoryStorageDouble } from "./support/storage-doubles.ts";

const domWindow = globalThis.window;
const domDocument = globalThis.document;
const PROBLEM_PAGE_PATH = "/contests/abc100/tasks/abc100_a";
const CONTEST_PAGE_PATH = "/contests/abc100";

function setDocument(html: string, pathname = "/") {
  domDocument.body.innerHTML = html;
  domWindow.history.replaceState({}, "", pathname);
}

function seedWorkspace(storage: ReviewStorePort, workspace: ReviewWorkspace) {
  const reviewStore = createReviewStoreAdapter(storage);
  const result = reviewStore.writeWorkspace(workspace);

  expect(result.ok).toBe(true);
}

describe("bootstrapUserscript", () => {
  beforeEach(() => {
    setDocument("", "/");
  });

  test("mounts the persistent menu entry only for authenticated sessions", () => {
    const storageDouble = createMemoryStorageDouble();

    setDocument(anonymousHeaderHtml());

    expect(domDocument.querySelector("#ac-revisit-menu-entry")).toBeNull();
    expect(bootstrapUserscript({ reviewStorage: storageDouble.storage })).toEqual({
      session: "anonymous",
      menuEntryMounted: false,
      toggleMounted: false,
    });

    setDocument(authenticatedProblemPageHtml(), PROBLEM_PAGE_PATH);

    const rerunResult = bootstrapUserscript({ reviewStorage: storageDouble.storage });

    expect(rerunResult).toEqual({
      session: "authenticated",
      menuEntryMounted: true,
      toggleMounted: true,
    });
    expect(domDocument.querySelector("#ac-revisit-menu-entry-link")?.textContent).toBe(
      "ac-revisit 操作",
    );
    expect(domDocument.querySelector("#ac-revisit-toggle-button")?.textContent).toBe(
      "復習対象に追加",
    );
  });

  test("wires the toggle button to persisted review registration", () => {
    const storageDouble = createMemoryStorageDouble();

    setDocument(authenticatedProblemPageHtml(), PROBLEM_PAGE_PATH);

    bootstrapUserscript({ reviewStorage: storageDouble.storage });

    const button = domDocument.querySelector("#ac-revisit-toggle-button");
    expect(button).toBeTruthy();
    expect(button?.textContent).toBe("復習対象に追加");

    button?.dispatchEvent(new domWindow.MouseEvent("click", { bubbles: true, cancelable: true }));

    expect(button?.textContent).toBe("復習対象から解除");

    setDocument(authenticatedProblemPageHtml(), PROBLEM_PAGE_PATH);

    bootstrapUserscript({ reviewStorage: storageDouble.storage });

    const rerenderedButton = domDocument.querySelector("#ac-revisit-toggle-button");
    expect(rerenderedButton).toBeTruthy();
    expect(rerenderedButton?.textContent).toBe("復習対象から解除");

    rerenderedButton?.dispatchEvent(
      new domWindow.MouseEvent("click", { bubbles: true, cancelable: true }),
    );

    expect(rerenderedButton?.textContent).toBe("復習対象に追加");
  });

  test("consumes the first bootstrap suggestion and opens the shared popup once", () => {
    const storageDouble = createMemoryStorageDouble();
    const popupCalls: PopupRequest[] = [];

    seedWorkspace(storageDouble.storage, {
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
        lastDailyEvaluatedOn: null,
      },
    });
    setDocument(authenticatedHeaderHtml(), CONTEST_PAGE_PATH);

    bootstrapUserscript({
      reviewStorage: storageDouble.storage,
      getToday: () => "2026-03-02",
      openPopup(input) {
        popupCalls.push(input);
      },
    });

    const reviewStore = createReviewStoreAdapter(storageDouble.storage);
    const firstWorkspace = reviewStore.readWorkspace();

    expect(firstWorkspace.ok).toBe(true);
    if (!firstWorkspace.ok) {
      throw new Error("expected workspace read to succeed");
    }
    expect(firstWorkspace.value.dailyState).toEqual({
      activeProblemId: "abc100/abc100_a",
      status: "incomplete",
      lastDailyEvaluatedOn: "2026-03-02",
    });
    expect(popupCalls).toEqual([
      {
        source: "bootstrap",
        today: "2026-03-02",
      },
    ]);

    bootstrapUserscript({
      reviewStorage: storageDouble.storage,
      getToday: () => "2026-03-02",
      openPopup(input) {
        popupCalls.push(input);
      },
    });

    expect(popupCalls).toHaveLength(1);
  });

  test("renders the shared popup shell by default for bootstrap auto-open", () => {
    const storageDouble = createMemoryStorageDouble();

    seedWorkspace(storageDouble.storage, {
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
        lastDailyEvaluatedOn: null,
      },
    });
    setDocument(authenticatedHeaderHtml(), CONTEST_PAGE_PATH);

    bootstrapUserscript({
      reviewStorage: storageDouble.storage,
      getToday: () => "2026-03-02",
    });

    const popup = domDocument.querySelector("#ac-revisit-popup");
    const title = domDocument.querySelector("#ac-revisit-popup-title");

    expect(popup).toBeTruthy();
    expect(popup?.getAttribute("role")).toBe("dialog");
    expect(popup?.getAttribute("data-source")).toBe("bootstrap");
    expect(title?.textContent).toBe("今日の一問");
  });
});
