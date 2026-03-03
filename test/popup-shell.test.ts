import { beforeEach, expect, test, vi } from "vitest";

import { createPopupShellPresenter } from "../src/presentation/popup-shell.ts";

const domWindow = globalThis.window;
const domDocument = globalThis.document;

function clearDocument() {
  domDocument.body.innerHTML = "";
  domWindow.history.replaceState({}, "", "/");
}

test("PopupShellPresenter renders one shared popup skeleton for both menu and bootstrap triggers", () => {
  clearDocument();

  const presentPopup = createPopupShellPresenter(domDocument);

  presentPopup({
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

  const root = domDocument.querySelector("#ac-revisit-popup-root");
  const overlay = domDocument.querySelector("#ac-revisit-popup-overlay");
  const panel = domDocument.querySelector("#ac-revisit-popup-panel");
  const heading = domDocument.querySelector("#ac-revisit-popup-title");
  const actionButton = domDocument.querySelector("#ac-revisit-popup-action");

  expect(root).toBeTruthy();
  expect(root?.getAttribute("role")).toBe("dialog");
  expect(root?.getAttribute("aria-modal")).toBe("true");
  expect(root?.getAttribute("data-source")).toBe("menu");
  expect(overlay).toBeTruthy();
  expect(panel).toBeTruthy();
  expect(heading?.textContent).toBe("今日の一問");
  expect(actionButton?.tagName).toBe("BUTTON");

  presentPopup({
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
  });

  expect(domDocument.querySelectorAll("#ac-revisit-popup-root")).toHaveLength(1);
  expect(domDocument.querySelector("#ac-revisit-popup-root")?.getAttribute("data-source")).toBe(
    "bootstrap",
  );
});

test("PopupShellPresenter enables the today link and labels the action as complete while today's problem is incomplete", () => {
  clearDocument();

  const presentPopup = createPopupShellPresenter(domDocument);

  presentPopup({
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

  const todayLink = domDocument.querySelector<HTMLAnchorElement>("#ac-revisit-popup-today-link");
  const actionButton = domDocument.querySelector<HTMLButtonElement>("#ac-revisit-popup-action");

  expect(todayLink?.textContent).toBe("A - Happy Birthday!");
  expect(todayLink?.getAttribute("href")).toBe("/contests/abc100/tasks/abc100_a");
  expect(todayLink?.getAttribute("aria-disabled")).toBeNull();
  expect(actionButton?.textContent).toBe("完了");
  expect(actionButton?.disabled).toBe(false);
});

test("PopupShellPresenter grays out the today link and disables the next action when no due candidates remain", () => {
  clearDocument();

  const presentPopup = createPopupShellPresenter(domDocument);

  presentPopup({
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
  });

  const todayLink = domDocument.querySelector<HTMLAnchorElement>("#ac-revisit-popup-today-link");
  const actionButton = domDocument.querySelector<HTMLButtonElement>("#ac-revisit-popup-action");

  expect(todayLink?.textContent).toBe("A - Happy Birthday!");
  expect(todayLink?.hasAttribute("href")).toBe(false);
  expect(todayLink?.getAttribute("aria-disabled")).toBe("true");
  expect(todayLink?.getAttribute("data-muted")).toBe("true");
  expect(actionButton?.textContent).toBe("もう一問");
  expect(actionButton?.disabled).toBe(true);
});

test("PopupShellPresenter enables the next action when today's problem is complete and due candidates remain", () => {
  clearDocument();

  const presentPopup = createPopupShellPresenter(domDocument);

  presentPopup({
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
  });

  const todayLink = domDocument.querySelector<HTMLAnchorElement>("#ac-revisit-popup-today-link");
  const actionButton = domDocument.querySelector<HTMLButtonElement>("#ac-revisit-popup-action");

  expect(todayLink?.textContent).toBe("A - Happy Birthday!");
  expect(todayLink?.hasAttribute("href")).toBe(false);
  expect(todayLink?.getAttribute("aria-disabled")).toBe("true");
  expect(todayLink?.getAttribute("data-muted")).toBe("true");
  expect(actionButton?.textContent).toBe("もう一問");
  expect(actionButton?.disabled).toBe(false);
});

test("PopupShellPresenter silently re-renders the popup and blocks stale today-link clicks", () => {
  clearDocument();

  const refreshPopup = vi.fn(() => ({
    source: "menu" as const,
    today: "2026-03-03" as const,
    reviewItems: [
      {
        problemId: "abc100/abc100_b",
        problemTitle: "B - Ringo's Favorite Numbers",
        registeredOn: "2026-02-16",
      },
    ],
    dailyState: {
      activeProblemId: "abc100/abc100_b",
      status: "incomplete" as const,
      lastDailyEvaluatedOn: "2026-03-03" as const,
    },
    hasDueCandidates: true,
  }));
  const runPrimaryAction = vi.fn();
  const presentPopup = createPopupShellPresenter(domDocument, {
    getToday: () => "2026-03-03",
    refreshPopup,
    runPrimaryAction,
  });

  presentPopup({
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

  const todayLink = domDocument.querySelector<HTMLAnchorElement>("#ac-revisit-popup-today-link");
  expect(todayLink).toBeTruthy();

  const wasAllowed = todayLink?.dispatchEvent(
    new domWindow.MouseEvent("click", { bubbles: true, cancelable: true }),
  );

  expect(wasAllowed).toBe(false);
  expect(refreshPopup).toHaveBeenCalledWith({
    source: "menu",
    today: "2026-03-03",
  });
  expect(runPrimaryAction).not.toHaveBeenCalled();
  expect(domDocument.querySelector("#ac-revisit-popup-root")?.getAttribute("data-active-problem-id")).toBe(
    "abc100/abc100_b",
  );
  expect(domDocument.querySelector("#ac-revisit-popup-root")?.getAttribute("data-last-daily-evaluated-on")).toBe(
    "2026-03-03",
  );
  expect(todayLink?.textContent).toBe("B - Ringo's Favorite Numbers");
});

test("PopupShellPresenter runs the primary action only after the popup state is revalidated", () => {
  clearDocument();

  const latestRequest = {
    source: "menu" as const,
    today: "2026-03-02" as const,
    reviewItems: [
      {
        problemId: "abc100/abc100_a",
        problemTitle: "A - Happy Birthday!",
        registeredOn: "2026-02-16",
      },
    ],
    dailyState: {
      activeProblemId: "abc100/abc100_a",
      status: "incomplete" as const,
      lastDailyEvaluatedOn: "2026-03-02" as const,
    },
    hasDueCandidates: true,
  };
  const refreshPopup = vi.fn(() => latestRequest);
  const runPrimaryAction = vi.fn(() => ({
    source: "menu" as const,
    today: "2026-03-02" as const,
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
      status: "complete" as const,
      lastDailyEvaluatedOn: "2026-03-02" as const,
    },
    hasDueCandidates: true,
  }));
  const presentPopup = createPopupShellPresenter(domDocument, {
    getToday: () => "2026-03-02",
    refreshPopup,
    runPrimaryAction,
  });

  presentPopup(latestRequest);

  const actionButton = domDocument.querySelector<HTMLButtonElement>("#ac-revisit-popup-action");
  expect(actionButton).toBeTruthy();

  actionButton?.dispatchEvent(
    new domWindow.MouseEvent("click", { bubbles: true, cancelable: true }),
  );

  expect(refreshPopup).toHaveBeenCalledWith({
    source: "menu",
    today: "2026-03-02",
  });
  expect(runPrimaryAction).toHaveBeenCalledWith({
    action: "complete",
    source: "menu",
    today: "2026-03-02",
    expectedDailyState: latestRequest.dailyState,
  });
  expect(domDocument.querySelector("#ac-revisit-popup-root")?.getAttribute("data-status")).toBe(
    "complete",
  );
  expect(actionButton?.textContent).toBe("もう一問");
  expect(actionButton?.disabled).toBe(false);
});

beforeEach(() => {
  clearDocument();
});
