import { beforeEach, expect, test, vi } from "vitest";

import {
  createPopupShellPresenter,
  createPopupStateLoader,
  type PopupStateSnapshot,
} from "../src/presentation/popup-shell.ts";
import type { DailySuggestionState, ReviewItem } from "../src/shared/types.ts";

const domWindow = globalThis.window;
const domDocument = globalThis.document;

function clearDocument() {
  domDocument.body.innerHTML = "";
  domDocument.body.className = "";
  domDocument.body.style.paddingRight = "";
  domWindow.history.replaceState({}, "", "/");
}

function buildSnapshot(input: {
  readonly source: "menu" | "bootstrap";
  readonly today: string;
  readonly reviewItems: readonly ReviewItem[];
  readonly dailyState: DailySuggestionState;
  readonly hasDueCandidates?: boolean;
}): PopupStateSnapshot {
  const popupStateLoader = createPopupStateLoader({
    listDueCandidates() {
      return input.hasDueCandidates === false ? [] : input.reviewItems;
    },
  });
  const result = popupStateLoader.load({
    mode: "workspace",
    source: input.source,
    today: input.today,
    reviewWorkspace: {
      reviewItems: input.reviewItems,
      dailyState: input.dailyState,
    },
  });

  expect(result.ok).toBe(true);

  if (!result.ok) {
    throw new Error("expected popup state loading to succeed");
  }

  return result.value;
}

test("PopupShellPresenter renders one shared popup skeleton for both menu and bootstrap triggers", () => {
  clearDocument();

  const presentPopup = createPopupShellPresenter(domDocument);

  presentPopup(
    buildSnapshot({
      source: "menu",
      today: "2026-03-02",
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
    }),
  );

  const root = domDocument.querySelector("#ac-revisit-popup-root");
  const overlay = domDocument.querySelector("#ac-revisit-popup-overlay");
  const panel = domDocument.querySelector("#ac-revisit-popup-panel");
  const header = domDocument.querySelector("#ac-revisit-popup-header");
  const body = domDocument.querySelector("#ac-revisit-popup-body");
  const footer = domDocument.querySelector("#ac-revisit-popup-footer");
  const heading = domDocument.querySelector("#ac-revisit-popup-title");
  const sectionTitle = domDocument.querySelector("#ac-revisit-popup-section-title");
  const description = domDocument.querySelector("#ac-revisit-popup-description");
  const closeButton = domDocument.querySelector("#ac-revisit-popup-close");
  const footerCloseButton = domDocument.querySelector("#ac-revisit-popup-dismiss");
  const todayLink = domDocument.querySelector("#ac-revisit-popup-today-link");
  const actionButton = domDocument.querySelector("#ac-revisit-popup-action");
  const styleTag = domDocument.querySelector("#ac-revisit-popup-style");

  expect(root).toBeTruthy();
  expect(root?.getAttribute("role")).toBe("dialog");
  expect(root?.getAttribute("aria-modal")).toBe("true");
  expect(root?.getAttribute("data-source")).toBe("menu");
  expect(root?.className).toBe("modal fade in");
  expect((root as HTMLElement | null)?.style.display).toBe("block");
  expect((root as HTMLElement | null)?.style.paddingRight).toBe("12px");
  expect(overlay).toBeTruthy();
  expect(overlay?.className).toBe("modal-backdrop fade in");
  expect(panel).toBeTruthy();
  expect(header).toBeTruthy();
  expect(body).toBeTruthy();
  expect(footer).toBeTruthy();
  expect(heading?.textContent).toBe("ac-revisit");
  expect(sectionTitle?.textContent).toBe("今日の一問");
  expect(description?.textContent).toBe("今日の復習対象です。解き終えたら完了で記録できます。");
  expect(closeButton?.textContent).toBe("×");
  expect(closeButton?.getAttribute("aria-label")).toBe("閉じる");
  expect(footerCloseButton?.textContent).toBe("close");
  expect(actionButton?.tagName).toBe("BUTTON");
  expect(todayLink?.className).toBe("");
  expect(actionButton?.className).toBe("btn btn-primary");
  expect(footerCloseButton?.className).toBe("btn btn-default");
  expect((header as HTMLElement | null)?.firstElementChild?.id).toBe("ac-revisit-popup-close");
  expect((body as HTMLElement | null)?.lastElementChild?.id).toBe("ac-revisit-popup-action");
  expect(styleTag).toBeNull();
  expect(domDocument.body.className).toBe("modal-open");
  expect(domDocument.body.style.paddingRight).toBe("12px");

  presentPopup(
    buildSnapshot({
      source: "bootstrap",
      today: "2026-03-02",
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
    }),
  );

  expect(domDocument.querySelectorAll("#ac-revisit-popup-root")).toHaveLength(1);
  expect(domDocument.querySelector("#ac-revisit-popup-root")?.getAttribute("data-source")).toBe(
    "bootstrap",
  );
});

test("PopupShellPresenter dismisses the popup from the close button, overlay, and Escape key", async () => {
  clearDocument();

  const presentPopup = createPopupShellPresenter(domDocument);
  const snapshot = buildSnapshot({
    source: "menu",
    today: "2026-03-02",
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

  presentPopup(snapshot);
  domDocument
    .querySelector<HTMLButtonElement>("#ac-revisit-popup-close")
    ?.dispatchEvent(new domWindow.MouseEvent("click", { bubbles: true, cancelable: true }));
  await new Promise((resolve) => domWindow.setTimeout(resolve, 320));
  expect(domDocument.querySelector("#ac-revisit-popup-root")).toBeNull();
  expect(domDocument.querySelector("#ac-revisit-popup-overlay")).toBeNull();
  expect(domDocument.body.className).toBe("");
  expect(domDocument.body.style.paddingRight).toBe("");

  presentPopup(snapshot);
  domDocument
    .querySelector<HTMLButtonElement>("#ac-revisit-popup-dismiss")
    ?.dispatchEvent(new domWindow.MouseEvent("click", { bubbles: true, cancelable: true }));
  await new Promise((resolve) => domWindow.setTimeout(resolve, 320));
  expect(domDocument.querySelector("#ac-revisit-popup-root")).toBeNull();
  expect(domDocument.querySelector("#ac-revisit-popup-overlay")).toBeNull();
  expect(domDocument.body.className).toBe("");
  expect(domDocument.body.style.paddingRight).toBe("");

  presentPopup(snapshot);
  domDocument
    .querySelector<HTMLDivElement>("#ac-revisit-popup-overlay")
    ?.dispatchEvent(new domWindow.MouseEvent("click", { bubbles: true, cancelable: true }));
  await new Promise((resolve) => domWindow.setTimeout(resolve, 320));
  expect(domDocument.querySelector("#ac-revisit-popup-root")).toBeNull();
  expect(domDocument.querySelector("#ac-revisit-popup-overlay")).toBeNull();
  expect(domDocument.body.className).toBe("");
  expect(domDocument.body.style.paddingRight).toBe("");

  presentPopup(snapshot);
  domDocument
    .querySelector<HTMLElement>("#ac-revisit-popup-root")
    ?.dispatchEvent(new domWindow.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  await new Promise((resolve) => domWindow.setTimeout(resolve, 320));
  expect(domDocument.querySelector("#ac-revisit-popup-root")).toBeNull();
  expect(domDocument.querySelector("#ac-revisit-popup-overlay")).toBeNull();
  expect(domDocument.body.className).toBe("");
  expect(domDocument.body.style.paddingRight).toBe("");
});

test("PopupShellPresenter enables the today link and labels the action as complete while today's problem is incomplete", () => {
  clearDocument();

  const presentPopup = createPopupShellPresenter(domDocument);

  presentPopup(
    buildSnapshot({
      source: "menu",
      today: "2026-03-02",
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
    }),
  );

  const todayLink = domDocument.querySelector<HTMLAnchorElement>("#ac-revisit-popup-today-link");
  const actionButton = domDocument.querySelector<HTMLButtonElement>("#ac-revisit-popup-action");
  const description = domDocument.querySelector<HTMLParagraphElement>(
    "#ac-revisit-popup-description",
  );

  expect(todayLink?.textContent).toBe("A - Happy Birthday!");
  expect(todayLink?.getAttribute("href")).toBe("/contests/abc100/tasks/abc100_a");
  expect(todayLink?.getAttribute("aria-disabled")).toBeNull();
  expect(todayLink?.className).toBe("");
  expect(description?.textContent).toBe("今日の復習対象です。解き終えたら完了で記録できます。");
  expect(actionButton?.textContent).toBe("完了");
  expect(actionButton?.disabled).toBe(false);
  expect(actionButton?.className).toBe("btn btn-primary");
});

test("PopupShellPresenter grays out the today link and disables the next action when no due candidates remain", () => {
  clearDocument();

  const presentPopup = createPopupShellPresenter(domDocument);

  presentPopup(
    buildSnapshot({
      source: "menu",
      today: "2026-03-02",
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
    }),
  );

  const todayLink = domDocument.querySelector<HTMLAnchorElement>("#ac-revisit-popup-today-link");
  const actionButton = domDocument.querySelector<HTMLButtonElement>("#ac-revisit-popup-action");
  const description = domDocument.querySelector<HTMLParagraphElement>(
    "#ac-revisit-popup-description",
  );

  expect(todayLink?.textContent).toBe("A - Happy Birthday!");
  expect(todayLink?.hasAttribute("href")).toBe(false);
  expect(todayLink?.getAttribute("aria-disabled")).toBe("true");
  expect(todayLink?.getAttribute("data-muted")).toBe("true");
  expect(todayLink?.className).toBe("text-muted");
  expect(description?.textContent).toBe(
    "今日の一問は完了済みです。次に進める復習対象はありません。",
  );
  expect(actionButton?.textContent).toBe("もう一問");
  expect(actionButton?.disabled).toBe(true);
  expect(actionButton?.style.cursor).toBe("not-allowed");
  expect(actionButton?.className).toBe("btn btn-default");
});

test("PopupShellPresenter enables the next action when today's problem is complete and due candidates remain", () => {
  clearDocument();

  const presentPopup = createPopupShellPresenter(domDocument);

  presentPopup(
    buildSnapshot({
      source: "menu",
      today: "2026-03-02",
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
      hasDueCandidates: true,
    }),
  );

  const todayLink = domDocument.querySelector<HTMLAnchorElement>("#ac-revisit-popup-today-link");
  const actionButton = domDocument.querySelector<HTMLButtonElement>("#ac-revisit-popup-action");
  const description = domDocument.querySelector<HTMLParagraphElement>(
    "#ac-revisit-popup-description",
  );

  expect(todayLink?.textContent).toBe("A - Happy Birthday!");
  expect(todayLink?.hasAttribute("href")).toBe(false);
  expect(todayLink?.getAttribute("aria-disabled")).toBe("true");
  expect(todayLink?.getAttribute("data-muted")).toBe("true");
  expect(todayLink?.className).toBe("text-muted");
  expect(description?.textContent).toBe(
    "今日の一問は完了済みです。必要ならもう一問で次に進めます。",
  );
  expect(actionButton?.textContent).toBe("もう一問");
  expect(actionButton?.disabled).toBe(false);
  expect(actionButton?.className).toBe("btn btn-primary");
});

test("PopupShellPresenter disables complete when neither today's suggestion nor due candidates exist", () => {
  clearDocument();

  const presentPopup = createPopupShellPresenter(domDocument);

  presentPopup(
    buildSnapshot({
      source: "menu",
      today: "2026-03-02",
      reviewItems: [],
      dailyState: {
        activeProblemId: null,
        status: "complete",
        lastDailyEvaluatedOn: "2026-03-02",
      },
      hasDueCandidates: false,
    }),
  );

  const todayLink = domDocument.querySelector<HTMLAnchorElement>("#ac-revisit-popup-today-link");
  const actionButton = domDocument.querySelector<HTMLButtonElement>("#ac-revisit-popup-action");
  const description = domDocument.querySelector<HTMLParagraphElement>(
    "#ac-revisit-popup-description",
  );

  expect(todayLink?.textContent).toBe("今日の一問はありません");
  expect(todayLink?.hasAttribute("href")).toBe(false);
  expect(todayLink?.getAttribute("aria-disabled")).toBe("true");
  expect(todayLink?.className).toBe("text-muted");
  expect(description?.textContent).toBe(
    "復習対象がありません。追加した問題は14日後に今日の一問として表示されます。",
  );
  expect(actionButton?.textContent).toBe("完了");
  expect(actionButton?.disabled).toBe(true);
  expect(actionButton?.className).toBe("btn btn-default");
});

test("PopupStateLoader reads the latest workspace in readonly mode without requiring popup refresh", () => {
  const readonlySnapshot = buildSnapshot({
    source: "menu",
    today: "2026-03-02",
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
  const popupStateLoader = createPopupStateLoader({
    readWorkspace() {
      return {
        ok: true as const,
        value: readonlySnapshot.reviewWorkspace,
      };
    },
    listDueCandidates(input) {
      return input.reviewItems;
    },
  });

  const result = popupStateLoader.load({
    mode: "readonly",
    source: "menu",
    today: "2026-03-02",
  });

  expect(result).toEqual({
    ok: true,
    value: readonlySnapshot,
  });
});

test("PopupShellPresenter silently re-renders the popup and blocks stale today-link clicks", () => {
  clearDocument();

  const latestSnapshot = buildSnapshot({
    source: "menu",
    today: "2026-03-03",
    reviewItems: [
      {
        problemId: "abc100/abc100_b",
        problemTitle: "B - Ringo's Favorite Numbers",
        registeredOn: "2026-02-16",
      },
    ],
    dailyState: {
      activeProblemId: "abc100/abc100_b",
      status: "incomplete",
      lastDailyEvaluatedOn: "2026-03-03",
    },
    hasDueCandidates: true,
  });
  const loadReadonly = vi.fn(() => latestSnapshot);
  const refreshPopup = vi.fn(() => latestSnapshot);
  const runPrimaryAction = vi.fn();
  const presentPopup = createPopupShellPresenter(domDocument, {
    getToday: () => "2026-03-03",
    loadReadonly,
    refreshPopup,
    runPrimaryAction,
  });

  presentPopup(
    buildSnapshot({
      source: "menu",
      today: "2026-03-02",
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
    }),
  );

  const todayLink = domDocument.querySelector<HTMLAnchorElement>("#ac-revisit-popup-today-link");
  expect(todayLink).toBeTruthy();

  const wasAllowed = todayLink?.dispatchEvent(
    new domWindow.MouseEvent("click", { bubbles: true, cancelable: true }),
  );

  expect(wasAllowed).toBe(false);
  expect(loadReadonly).toHaveBeenCalledWith({
    source: "menu",
    today: "2026-03-03",
  });
  expect(refreshPopup).toHaveBeenCalledWith({
    source: "menu",
    today: "2026-03-03",
  });
  expect(runPrimaryAction).not.toHaveBeenCalled();
  expect(
    domDocument.querySelector("#ac-revisit-popup-root")?.getAttribute("data-active-problem-id"),
  ).toBe("abc100/abc100_b");
  expect(
    domDocument
      .querySelector("#ac-revisit-popup-root")
      ?.getAttribute("data-last-daily-evaluated-on"),
  ).toBe("2026-03-03");
  expect(todayLink?.textContent).toBe("B - Ringo's Favorite Numbers");
  expect(domDocument.body.className).toBe("modal-open");
  expect(domDocument.body.style.paddingRight).toBe("12px");
});

test("PopupShellPresenter runs the primary action only after readonly revalidation succeeds", () => {
  clearDocument();

  const latestSnapshot = buildSnapshot({
    source: "menu",
    today: "2026-03-02",
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
  const loadReadonly = vi.fn(() => latestSnapshot);
  const refreshPopup = vi.fn();
  const runPrimaryAction = vi.fn(() =>
    buildSnapshot({
      source: "menu",
      today: "2026-03-02",
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
      ],
      dailyState: {
        activeProblemId: null,
        status: "complete",
        lastDailyEvaluatedOn: "2026-03-02",
      },
      hasDueCandidates: true,
    }),
  );
  const presentPopup = createPopupShellPresenter(domDocument, {
    getToday: () => "2026-03-02",
    loadReadonly,
    refreshPopup,
    runPrimaryAction,
  });

  presentPopup(latestSnapshot);

  const actionButton = domDocument.querySelector<HTMLButtonElement>("#ac-revisit-popup-action");
  expect(actionButton).toBeTruthy();

  actionButton?.dispatchEvent(
    new domWindow.MouseEvent("click", { bubbles: true, cancelable: true }),
  );

  expect(loadReadonly).toHaveBeenCalledWith({
    source: "menu",
    today: "2026-03-02",
  });
  expect(refreshPopup).not.toHaveBeenCalled();
  expect(runPrimaryAction).toHaveBeenCalledWith({
    action: "complete",
    source: "menu",
    today: "2026-03-02",
    expectedDailyState: latestSnapshot.reviewWorkspace.dailyState,
  });
  expect(domDocument.querySelector("#ac-revisit-popup-root")?.getAttribute("data-status")).toBe(
    "complete",
  );
  expect(actionButton?.textContent).toBe("もう一問");
  expect(actionButton?.disabled).toBe(false);
});

test("PopupShellPresenter blocks popup actions when readonly revalidation cannot load the latest state", () => {
  clearDocument();

  const loadReadonly = vi.fn(() => null);
  const refreshPopup = vi.fn();
  const runPrimaryAction = vi.fn();
  const presentPopup = createPopupShellPresenter(domDocument, {
    getToday: () => "2026-03-02",
    loadReadonly,
    refreshPopup,
    runPrimaryAction,
  });

  presentPopup(
    buildSnapshot({
      source: "menu",
      today: "2026-03-02",
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
    }),
  );

  const todayLink = domDocument.querySelector<HTMLAnchorElement>("#ac-revisit-popup-today-link");
  const actionButton = domDocument.querySelector<HTMLButtonElement>("#ac-revisit-popup-action");

  const linkAllowed = todayLink?.dispatchEvent(
    new domWindow.MouseEvent("click", { bubbles: true, cancelable: true }),
  );
  actionButton?.dispatchEvent(
    new domWindow.MouseEvent("click", { bubbles: true, cancelable: true }),
  );

  expect(linkAllowed).toBe(false);
  expect(loadReadonly).toHaveBeenCalledTimes(2);
  expect(refreshPopup).not.toHaveBeenCalled();
  expect(runPrimaryAction).not.toHaveBeenCalled();
  expect(domDocument.querySelector("#ac-revisit-popup-root")?.getAttribute("data-status")).toBe(
    "incomplete",
  );
});

beforeEach(() => {
  clearDocument();
});
