import { beforeEach, describe, expect, test } from "vitest";

import {
  bootstrapUserscript,
  readUserscriptWorkspaceSnapshot,
} from "../src/bootstrap/userscript.ts";
import { createReviewStoreAdapter } from "../src/persistence/review-store.ts";
import type { PopupRequest } from "../src/bootstrap/userscript.ts";
import type { ReviewStorePort } from "../src/persistence/review-store.ts";
import type { ReviewWorkspace } from "../src/shared/types.ts";
import {
  anonymousHeaderHtml,
  authenticatedHeaderHtml,
  authenticatedProblemPageHtml,
  submissionDetailHtml,
} from "./support/dom-fixtures.ts";
import { createMemoryStorageDouble } from "./support/storage-doubles.ts";

const domWindow = globalThis.window;
const domDocument = globalThis.document;
const PROBLEM_PAGE_PATH = "/contests/abc100/tasks/abc100_a";
const CONTEST_PAGE_PATH = "/contests/abc100";
const SUBMISSION_PAGE_PATH = "/contests/abc388/submissions/61566375";
const originalGMGetValue = globalThis.GM_getValue;
const originalGMSetValue = globalThis.GM_setValue;

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
    globalThis.GM_getValue = originalGMGetValue;
    globalThis.GM_setValue = originalGMSetValue;
  });

  test("reads the dev workspace snapshot through the userscript review storage adapter", () => {
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
        activeProblemId: "abc100/abc100_a",
        status: "incomplete",
        lastDailyEvaluatedOn: "2026-03-02",
      },
    });

    globalThis.GM_getValue = (<T>(key: string, defaultValue: T) => {
      const value = storageDouble.storage.get(key);
      return value === null ? defaultValue : (value as T);
    }) as typeof GM_getValue;
    globalThis.GM_setValue = ((key: string, value: string) => {
      storageDouble.storage.set(key, value);
    }) as typeof GM_setValue;

    expect(readUserscriptWorkspaceSnapshot()).toEqual({
      ok: true,
      value: {
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
      },
    });
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
    expect(domDocument.querySelector("#ac-revisit-menu-entry-link")?.textContent).toContain(
      "ac-revisit 操作",
    );
    expect(domDocument.querySelector("#ac-revisit-toggle-button")?.textContent).toBe(
      "ac-revisit 追加",
    );
  });

  test("does not evaluate suggestions or auto-open a popup for anonymous sessions", () => {
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
    setDocument(anonymousHeaderHtml(), CONTEST_PAGE_PATH);

    const result = bootstrapUserscript({
      reviewStorage: storageDouble.storage,
      getToday: () => "2026-03-02",
      openPopup(input) {
        popupCalls.push(input);
      },
    });
    const reviewStore = createReviewStoreAdapter(storageDouble.storage);
    const workspaceResult = reviewStore.readWorkspace();

    expect(result).toEqual({
      session: "anonymous",
      menuEntryMounted: false,
      toggleMounted: false,
    });
    expect(workspaceResult.ok).toBe(true);
    if (!workspaceResult.ok) {
      throw new Error("expected workspace read to succeed");
    }
    expect(workspaceResult.value.dailyState).toEqual({
      activeProblemId: null,
      status: "complete",
      lastDailyEvaluatedOn: null,
    });
    expect(popupCalls).toEqual([]);
  });

  test("keeps third-party menu entries and does not inherit large class on top-page header", () => {
    const storageDouble = createMemoryStorageDouble();
    setDocument(
      `
        <header id="header">
          <div class="header-mypage">
            <button class="j-dropdown_mypage">yiwiy9</button>
          </div>
          <div class="header-mypage_detail">
            <ul class="header-mypage_list">
              <li class="large"><a href="/users/yiwiy9"><i class="a-icon a-icon-user"></i> マイプロフィール</a></li>
              <li><a href="/settings"><i class="a-icon a-icon-setting"></i> 基本設定</a></li>
              <li><a id="ac-predictor-settings-dropdown-button" href="#"><i class="a-icon a-icon-setting"></i> ac-predictor 設定</a></li>
              <li class="large"><a href="javascript:void(form_logout.submit())"><i class="a-icon a-icon-logout"></i> ログアウト</a></li>
            </ul>
          </div>
        </header>
      `,
      CONTEST_PAGE_PATH,
    );

    const result = bootstrapUserscript({ reviewStorage: storageDouble.storage });
    const insertedEntry = domDocument.querySelector<HTMLLIElement>("#ac-revisit-menu-entry");
    const insertedIcon = domDocument.querySelector("#ac-revisit-menu-entry [data-icon]");
    const predictorEntry = domDocument.querySelector("#ac-predictor-settings-dropdown-button");

    expect(result).toEqual({
      session: "authenticated",
      menuEntryMounted: true,
      toggleMounted: false,
    });
    expect(insertedEntry).toBeTruthy();
    expect(insertedEntry?.classList.contains("large")).toBe(false);
    expect(insertedIcon?.className).toContain("a-icon-setting");
    expect(predictorEntry).toBeTruthy();
  });

  test("re-mounts menu entry safely after external DOM rewrite without duplicating items", () => {
    const storageDouble = createMemoryStorageDouble();
    setDocument(
      `
        <header id="header">
          <div class="header-mypage">
            <button class="j-dropdown_mypage">yiwiy9</button>
          </div>
          <div class="header-mypage_detail">
            <ul class="header-mypage_list">
              <li class="large"><a href="/users/yiwiy9"><i class="a-icon a-icon-user"></i> マイプロフィール</a></li>
              <li><a href="/settings"><i class="a-icon a-icon-setting"></i> 基本設定</a></li>
              <li><a id="ac-predictor-settings-dropdown-button" href="#"><i class="a-icon a-icon-setting"></i> ac-predictor 設定</a></li>
              <li class="large"><a href="javascript:void(form_logout.submit())"><i class="a-icon a-icon-logout"></i> ログアウト</a></li>
            </ul>
          </div>
        </header>
      `,
      CONTEST_PAGE_PATH,
    );

    bootstrapUserscript({ reviewStorage: storageDouble.storage });

    const firstEntry = domDocument.querySelector<HTMLLIElement>("#ac-revisit-menu-entry");
    expect(firstEntry).toBeTruthy();
    firstEntry?.remove();

    const rerunResult = bootstrapUserscript({ reviewStorage: storageDouble.storage });
    const entries = domDocument.querySelectorAll("#ac-revisit-menu-entry");
    const predictorEntries = domDocument.querySelectorAll("#ac-predictor-settings-dropdown-button");
    const logoutEntries = Array.from(domDocument.querySelectorAll(".header-mypage_list a")).filter(
      (link) => (link.textContent ?? "").includes("ログアウト"),
    );
    const remountedEntry = domDocument.querySelector<HTMLLIElement>("#ac-revisit-menu-entry");

    expect(rerunResult.session).toBe("authenticated");
    expect(rerunResult.menuEntryMounted).toBe(true);
    expect(entries).toHaveLength(1);
    expect(predictorEntries).toHaveLength(1);
    expect(logoutEntries).toHaveLength(1);
    expect(remountedEntry?.classList.contains("large")).toBe(false);
  });

  test("wires the toggle button to persisted review registration", () => {
    const storageDouble = createMemoryStorageDouble();

    setDocument(authenticatedProblemPageHtml(), PROBLEM_PAGE_PATH);

    bootstrapUserscript({ reviewStorage: storageDouble.storage });

    const button = domDocument.querySelector("#ac-revisit-toggle-button");
    expect(button).toBeTruthy();
    expect(button?.textContent).toBe("ac-revisit 追加");

    button?.dispatchEvent(new domWindow.MouseEvent("click", { bubbles: true, cancelable: true }));

    expect(button?.textContent).toBe("ac-revisit 解除");

    setDocument(authenticatedProblemPageHtml(), PROBLEM_PAGE_PATH);

    bootstrapUserscript({ reviewStorage: storageDouble.storage });

    const rerenderedButton = domDocument.querySelector("#ac-revisit-toggle-button");
    expect(rerenderedButton).toBeTruthy();
    expect(rerenderedButton?.textContent).toBe("ac-revisit 解除");

    rerenderedButton?.dispatchEvent(
      new domWindow.MouseEvent("click", { bubbles: true, cancelable: true }),
    );

    expect(rerenderedButton?.textContent).toBe("ac-revisit 追加");
  });

  test("mounts the review toggle on authenticated submission detail pages", () => {
    const storageDouble = createMemoryStorageDouble();

    setDocument(
      `
        ${authenticatedHeaderHtml()}
        ${submissionDetailHtml()}
      `,
      SUBMISSION_PAGE_PATH,
    );

    const result = bootstrapUserscript({ reviewStorage: storageDouble.storage });

    expect(result).toEqual({
      session: "authenticated",
      menuEntryMounted: true,
      toggleMounted: true,
    });
    expect(domDocument.querySelector("#ac-revisit-toggle-button")?.textContent).toBe(
      "ac-revisit 追加",
    );
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
        dailyState: {
          activeProblemId: "abc100/abc100_a",
          status: "incomplete",
          lastDailyEvaluatedOn: "2026-03-02",
        },
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

  test("mounts available startup entrypoints before the bootstrap auto-popup opens", () => {
    const storageDouble = createMemoryStorageDouble();
    const popupCalls: Array<
      PopupRequest & {
        readonly menuEntryMountedAtOpen: boolean;
        readonly toggleMountedAtOpen: boolean;
      }
    > = [];

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
    setDocument(authenticatedProblemPageHtml(), PROBLEM_PAGE_PATH);

    bootstrapUserscript({
      reviewStorage: storageDouble.storage,
      getToday: () => "2026-03-02",
      openPopup(input) {
        popupCalls.push({
          ...input,
          menuEntryMountedAtOpen: domDocument.getElementById("ac-revisit-menu-entry") !== null,
          toggleMountedAtOpen: domDocument.getElementById("ac-revisit-toggle-button") !== null,
        });
      },
    });

    expect(popupCalls).toEqual([
      {
        source: "bootstrap",
        today: "2026-03-02",
        dailyState: {
          activeProblemId: "abc100/abc100_a",
          status: "incomplete",
          lastDailyEvaluatedOn: "2026-03-02",
        },
        menuEntryMountedAtOpen: true,
        toggleMountedAtOpen: true,
      },
    ]);
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

    const popup = domDocument.querySelector("#ac-revisit-popup-root");
    const overlay = domDocument.querySelector("#ac-revisit-popup-overlay");
    const panel = domDocument.querySelector("#ac-revisit-popup-panel");
    const title = domDocument.querySelector("#ac-revisit-popup-title");
    const actionButton = domDocument.querySelector("#ac-revisit-popup-action");

    expect(popup).toBeTruthy();
    expect(popup?.getAttribute("role")).toBe("dialog");
    expect(popup?.getAttribute("data-source")).toBe("bootstrap");
    expect(popup?.getAttribute("data-status")).toBe("incomplete");
    expect(popup?.getAttribute("data-active-problem-id")).toBe("abc100/abc100_a");
    expect(popup?.getAttribute("data-last-daily-evaluated-on")).toBe("2026-03-02");
    expect(overlay).toBeTruthy();
    expect(panel).toBeTruthy();
    expect(title?.textContent).toBe("ac-revisit");
    expect(actionButton?.textContent).toBe("完了");
  });

  test("resolves today's suggestion before opening the popup from the menu", () => {
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

    popupCalls.length = 0;

    const menuLink = domDocument.querySelector("#ac-revisit-menu-entry-link");
    expect(menuLink).toBeTruthy();

    menuLink?.dispatchEvent(new domWindow.MouseEvent("click", { bubbles: true, cancelable: true }));

    expect(popupCalls).toEqual([
      {
        source: "menu",
        today: "2026-03-02",
        dailyState: {
          activeProblemId: "abc100/abc100_a",
          status: "incomplete",
          lastDailyEvaluatedOn: "2026-03-02",
        },
      },
    ]);
  });

  test("reuses the shared popup shell when the persistent menu entry opens after bootstrap auto-open", () => {
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

    const menuLink = domDocument.querySelector("#ac-revisit-menu-entry-link");
    expect(menuLink).toBeTruthy();
    expect(domDocument.querySelectorAll("#ac-revisit-popup-root")).toHaveLength(1);
    expect(domDocument.querySelector("#ac-revisit-popup-root")?.getAttribute("data-source")).toBe(
      "bootstrap",
    );

    menuLink?.dispatchEvent(new domWindow.MouseEvent("click", { bubbles: true, cancelable: true }));

    expect(domDocument.querySelectorAll("#ac-revisit-popup-root")).toHaveLength(1);
    expect(domDocument.querySelector("#ac-revisit-popup-root")?.getAttribute("data-source")).toBe(
      "menu",
    );
    expect(domDocument.querySelector("#ac-revisit-popup-title")?.textContent).toBe("ac-revisit");
    expect(domDocument.querySelector("#ac-revisit-popup-action")?.textContent).toBe("完了");
  });

  test("keeps bootstrap silent when no due candidates exist and renders the constrained menu popup instead", () => {
    const storageDouble = createMemoryStorageDouble();

    seedWorkspace(storageDouble.storage, {
      reviewItems: [
        {
          problemId: "abc100/abc100_a",
          problemTitle: "A - Happy Birthday!",
          registeredOn: "2026-02-20",
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

    expect(domDocument.querySelector("#ac-revisit-popup-root")).toBeNull();

    const menuLink = domDocument.querySelector("#ac-revisit-menu-entry-link");
    expect(menuLink).toBeTruthy();

    menuLink?.dispatchEvent(new domWindow.MouseEvent("click", { bubbles: true, cancelable: true }));

    const todayLink = domDocument.querySelector<HTMLAnchorElement>("#ac-revisit-popup-today-link");
    const actionButton = domDocument.querySelector<HTMLButtonElement>("#ac-revisit-popup-action");

    expect(domDocument.querySelector("#ac-revisit-popup-root")?.getAttribute("data-source")).toBe(
      "menu",
    );
    expect(domDocument.querySelector("#ac-revisit-popup-root")?.getAttribute("data-status")).toBe(
      "complete",
    );
    expect(todayLink?.textContent).toBeTruthy();
    expect(todayLink?.getAttribute("aria-disabled")).toBe("true");
    expect(actionButton?.textContent).toBe("完了");
    expect(actionButton?.disabled).toBe(true);
  });

  test("silently re-renders stale popup interactions through the wired bootstrap presenter", () => {
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

    const reviewStore = createReviewStoreAdapter(storageDouble.storage);
    const rewriteResult = reviewStore.writeWorkspace({
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
        lastDailyEvaluatedOn: "2026-03-02",
      },
    });

    expect(rewriteResult.ok).toBe(true);

    const actionButton = domDocument.querySelector<HTMLButtonElement>("#ac-revisit-popup-action");
    expect(actionButton).toBeTruthy();

    actionButton?.dispatchEvent(
      new domWindow.MouseEvent("click", { bubbles: true, cancelable: true }),
    );

    const latestWorkspace = reviewStore.readWorkspace();
    expect(latestWorkspace.ok).toBe(true);
    if (!latestWorkspace.ok) {
      throw new Error("expected workspace read to succeed");
    }
    expect(latestWorkspace.value.dailyState).toEqual({
      activeProblemId: "abc100/abc100_b",
      status: "incomplete",
      lastDailyEvaluatedOn: "2026-03-02",
    });
    expect(
      domDocument.querySelector("#ac-revisit-popup-root")?.getAttribute("data-active-problem-id"),
    ).toBe("abc100/abc100_b");
    expect(domDocument.querySelector("#ac-revisit-popup-today-link")?.textContent).toBe(
      "B - Ringo's Favorite Numbers",
    );
  });

  test("does not self-heal missing toggle anchors after startup", () => {
    const storageDouble = createMemoryStorageDouble();

    setDocument(
      `
        ${authenticatedHeaderHtml()}
        <div class="col-sm-12">
          <div>A - Happy Birthday!</div>
        </div>
      `,
      PROBLEM_PAGE_PATH,
    );

    const result = bootstrapUserscript({ reviewStorage: storageDouble.storage });

    expect(result).toEqual({
      session: "authenticated",
      menuEntryMounted: true,
      toggleMounted: false,
    });
    expect(domDocument.querySelector("#ac-revisit-toggle-button")).toBeNull();

    domDocument.querySelector(".col-sm-12")?.replaceChildren(
      Object.assign(domDocument.createElement("span"), {
        className: "h2",
        textContent: "A - Happy Birthday!",
      }),
    );

    expect(domDocument.querySelector("#ac-revisit-toggle-button")).toBeNull();
  });

  test("records fail-closed startup diagnostics for unresolved toggle mount paths", () => {
    const storageDouble = createMemoryStorageDouble();
    const diagnostics: Array<{
      code: string;
      component: string;
      operation: string;
    }> = [];

    setDocument(
      `
        ${authenticatedHeaderHtml()}
        <div class="col-sm-12">
          <div>A - Happy Birthday!</div>
        </div>
      `,
      PROBLEM_PAGE_PATH,
    );

    const result = bootstrapUserscript({
      reviewStorage: storageDouble.storage,
      diagnosticSink(event) {
        diagnostics.push(event);
      },
    });

    expect(result).toEqual({
      session: "authenticated",
      menuEntryMounted: true,
      toggleMounted: false,
    });
    expect(diagnostics).toEqual([
      {
        code: "anchor_missing",
        component: "ToggleMountCoordinator",
        operation: "startup_toggle_mount",
      },
    ]);
  });

  test("records fail-closed startup diagnostics when the problem context is unresolvable", () => {
    const storageDouble = createMemoryStorageDouble();
    const diagnostics: Array<{
      code: string;
      component: string;
      operation: string;
    }> = [];

    setDocument(
      `
        ${authenticatedHeaderHtml()}
        <div class="col-sm-12">
          <span class="h2"></span>
        </div>
      `,
      PROBLEM_PAGE_PATH,
    );

    const result = bootstrapUserscript({
      reviewStorage: storageDouble.storage,
      diagnosticSink(event) {
        diagnostics.push(event);
      },
    });

    expect(result).toEqual({
      session: "authenticated",
      menuEntryMounted: true,
      toggleMounted: false,
    });
    expect(diagnostics).toEqual([
      {
        code: "problem_unresolvable",
        component: "ToggleMountCoordinator",
        operation: "startup_toggle_mount",
      },
    ]);
  });

  test("records storage diagnostics without surfacing user-visible startup errors", () => {
    const storageDouble = createMemoryStorageDouble({ failOnRead: true });
    const diagnostics: Array<{
      code: string;
      component: string;
      operation: string;
    }> = [];

    setDocument(authenticatedProblemPageHtml(), PROBLEM_PAGE_PATH);

    const result = bootstrapUserscript({
      reviewStorage: storageDouble.storage,
      diagnosticSink(event) {
        diagnostics.push(event);
      },
    });

    expect(result).toEqual({
      session: "authenticated",
      menuEntryMounted: true,
      toggleMounted: true,
    });
    expect(diagnostics).toEqual([
      {
        code: "storage_unavailable",
        component: "ReviewStoreAdapter",
        operation: "startup_toggle_state_load",
      },
      {
        code: "storage_unavailable",
        component: "DailySuggestionService",
        operation: "startup_daily_suggestion",
      },
    ]);
    expect(domDocument.querySelector("#ac-revisit-popup-root")).toBeNull();
  });
});
