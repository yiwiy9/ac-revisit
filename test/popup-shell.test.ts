import { beforeEach, expect, test } from "vitest";

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

beforeEach(() => {
  clearDocument();
});
