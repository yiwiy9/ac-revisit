import { beforeEach, describe, expect, test } from "vitest";

import {
  createAtCoderPageAdapter,
  createAuthSessionGuard,
  createMenuEntryAdapter,
  createProblemContextResolver,
  createToggleMountCoordinator,
} from "../src/runtime/atcoder-shell.ts";
import type { PopupOpenInput, ToggleInteractionInput } from "../src/runtime/atcoder-shell.ts";
import {
  anonymousHeaderHtml,
  authenticatedHeaderHtml,
  problemHeadingHtml,
  submissionDetailHtml,
  topPageHeaderHtml,
} from "./support/dom-fixtures.ts";

const domWindow = globalThis.window;
const domDocument = globalThis.document;

function setDocument(html: string, pathname = "/") {
  domDocument.body.innerHTML = html;
  domWindow.history.replaceState({}, "", pathname);
}

function renderLegacyHeader(pathname = "/contests/abc100/tasks/abc100_a") {
  setDocument(authenticatedHeaderHtml(), pathname);
}

function renderTopPageHeader() {
  setDocument(topPageHeaderHtml());
}

function renderAnonymousHeader() {
  setDocument(anonymousHeaderHtml());
}

describe("atcoder shell", () => {
  beforeEach(() => {
    setDocument("", "/");
  });

  describe("AuthSessionGuard", () => {
    test("resolves authenticated on legacy contest pages using the legacy user menu signal", () => {
      renderLegacyHeader();
      const adapter = createAtCoderPageAdapter(domWindow, domDocument);
      const guard = createAuthSessionGuard(adapter);

      expect(guard.resolveSession()).toEqual({
        kind: "authenticated",
        userHandle: "tourist",
      });
    });

    test("resolves authenticated on the top page using the new mypage signal", () => {
      renderTopPageHeader();
      const adapter = createAtCoderPageAdapter(domWindow, domDocument);
      const guard = createAuthSessionGuard(adapter);

      expect(guard.resolveSession()).toEqual({
        kind: "authenticated",
        userHandle: "tourist",
      });
    });

    test("fails closed when no supported header signal exists", () => {
      renderAnonymousHeader();
      const adapter = createAtCoderPageAdapter(domWindow, domDocument);
      const guard = createAuthSessionGuard(adapter);

      expect(guard.resolveSession()).toEqual({ kind: "anonymous" });
    });
  });

  describe("MenuEntryAdapter", () => {
    test("mounts the persistent menu entry once on the legacy menu anchor", () => {
      renderLegacyHeader();
      const adapter = createAtCoderPageAdapter(domWindow, domDocument);
      const openCalls: PopupOpenInput[] = [];
      const menuEntry = createMenuEntryAdapter({
        pageAdapter: adapter,
        getToday: () => "2026-03-02",
        openPopup(input) {
          openCalls.push(input);
        },
      });

      expect(menuEntry.ensureEntryMounted()).toEqual({
        ok: true,
        value: { mounted: true },
      });
      expect(menuEntry.ensureEntryMounted()).toEqual({
        ok: true,
        value: { mounted: false },
      });

      const entry = domDocument.querySelector("#ac-revisit-menu-entry");
      const link = domDocument.querySelector("#ac-revisit-menu-entry-link");
      const icon = link?.querySelector("[data-icon]");
      const label = link?.querySelector("[data-label]");

      expect(entry).toBeTruthy();
      expect(domDocument.querySelectorAll("#ac-revisit-menu-entry")).toHaveLength(1);
      expect(entry?.tagName).toBe("LI");
      expect(link?.textContent).toContain("ac-revisit 操作");
      expect(icon?.className).toContain("glyphicon-cog");
      expect(label?.textContent).toBe("ac-revisit 操作");

      link?.dispatchEvent(new domWindow.MouseEvent("click", { bubbles: true, cancelable: true }));

      expect(openCalls).toEqual([
        {
          source: "menu",
          today: "2026-03-02",
        },
      ]);
    });

    test("mounts the persistent menu entry on the top page new header anchor", () => {
      renderTopPageHeader();
      const adapter = createAtCoderPageAdapter(domWindow, domDocument);
      const openCalls: PopupOpenInput[] = [];
      const menuEntry = createMenuEntryAdapter({
        pageAdapter: adapter,
        getToday: () => "2026-03-02",
        openPopup(input) {
          openCalls.push(input);
        },
      });

      expect(menuEntry.ensureEntryMounted()).toEqual({
        ok: true,
        value: { mounted: true },
      });

      const topPageMenu = domDocument.querySelector(".header-mypage_detail .header-mypage_list");
      const entry = domDocument.querySelector("#ac-revisit-menu-entry");
      const link = domDocument.querySelector("#ac-revisit-menu-entry-link");

      expect(topPageMenu).toBeTruthy();
      expect(entry?.parentElement).toBe(topPageMenu);
      expect(link?.textContent).toContain("ac-revisit 操作");

      link?.dispatchEvent(new domWindow.MouseEvent("click", { bubbles: true, cancelable: true }));

      expect(openCalls).toEqual([
        {
          source: "menu",
          today: "2026-03-02",
        },
      ]);
    });

    test("reuses a-icon settings icon in top-page menu so entry size matches existing items", () => {
      setDocument(
        `
          <header id="header">
            <div class="header-mypage">
              <button class="j-dropdown_mypage">tourist</button>
            </div>
            <div class="header-mypage_detail">
              <ul class="header-mypage_list">
                <li class="large"><a href="/users/tourist"><i class="a-icon a-icon-user"></i> マイプロフィール</a></li>
                <li><a href="/settings"><i class="a-icon a-icon-setting"></i> 基本設定</a></li>
                <li class="large"><a href="javascript:void(form_logout.submit())"><i class="a-icon a-icon-logout"></i> ログアウト</a></li>
              </ul>
            </div>
          </header>
        `,
      );
      const adapter = createAtCoderPageAdapter(domWindow, domDocument);
      const menuEntry = createMenuEntryAdapter({
        pageAdapter: adapter,
        getToday: () => "2026-03-02",
        openPopup() {},
      });

      expect(menuEntry.ensureEntryMounted()).toEqual({
        ok: true,
        value: { mounted: true },
      });

      const icon = domDocument.querySelector("#ac-revisit-menu-entry [data-icon]");
      const inserted = domDocument.querySelector<HTMLLIElement>("#ac-revisit-menu-entry");
      expect(icon?.className).toContain("a-icon-setting");
      expect(inserted?.classList.contains("large")).toBe(false);
    });

    test("returns anchor_missing when no supported menu anchor exists", () => {
      renderAnonymousHeader();
      const adapter = createAtCoderPageAdapter(domWindow, domDocument);
      const menuEntry = createMenuEntryAdapter({
        pageAdapter: adapter,
        getToday: () => "2026-03-02",
        openPopup() {
          throw new Error("must not be called");
        },
      });

      expect(menuEntry.ensureEntryMounted()).toEqual({
        ok: false,
        error: { kind: "anchor_missing" },
      });
      expect(domDocument.querySelector("#ac-revisit-menu-entry")).toBeNull();
    });

    test("inserts the persistent menu entry immediately before logout and reuses the settings icon styling", () => {
      setDocument(
        `
          <nav class="navbar">
            <ul class="navbar-right">
              <li class="dropdown">
                <a class="dropdown-toggle">tourist</a>
                <ul class="dropdown-menu">
                  <li><a href="/users/tourist">プロフィール</a></li>
                  <li id="settings-item"><a href="/settings"><span class="glyphicon glyphicon-cog"></span> 設定</a></li>
                  <li><a href="/logout">ログアウト</a></li>
                </ul>
              </li>
            </ul>
          </nav>
        `,
      );
      const adapter = createAtCoderPageAdapter(domWindow, domDocument);
      const menuEntry = createMenuEntryAdapter({
        pageAdapter: adapter,
        getToday: () => "2026-03-02",
        openPopup() {},
      });

      expect(menuEntry.ensureEntryMounted()).toEqual({
        ok: true,
        value: { mounted: true },
      });

      const menuItems = Array.from(domDocument.querySelectorAll(".dropdown-menu > li")).map(
        (item) =>
          item.id === "ac-revisit-menu-entry" ? "ac-revisit" : item.id || item.textContent?.trim(),
      );
      const insertedIcon = domDocument.querySelector("#ac-revisit-menu-entry [data-icon]");

      expect(menuItems).toEqual(["プロフィール", "settings-item", "ac-revisit", "ログアウト"]);
      expect(insertedIcon?.className).toContain("glyphicon-cog");
    });

    test("selects the user dropdown menu even when other dropdown menus exist earlier in the DOM", () => {
      setDocument(
        `
          <nav class="navbar">
            <ul class="navbar-left">
              <li class="dropdown">
                <a class="dropdown-toggle">Contest</a>
                <ul class="dropdown-menu" id="contest-menu">
                  <li><a href="/contests">コンテスト一覧</a></li>
                </ul>
              </li>
            </ul>
            <ul class="navbar-right">
              <li class="dropdown">
                <a class="dropdown-toggle">tourist</a>
                <ul class="dropdown-menu" id="user-menu">
                  <li><a href="/users/tourist">プロフィール</a></li>
                  <li><a href="/settings"><span class="glyphicon glyphicon-wrench"></span> 基本設定</a></li>
                  <li><a href="javascript:void(form_logout.submit())">ログアウト</a></li>
                </ul>
              </li>
            </ul>
          </nav>
        `,
      );
      const adapter = createAtCoderPageAdapter(domWindow, domDocument);
      const menuEntry = createMenuEntryAdapter({
        pageAdapter: adapter,
        getToday: () => "2026-03-02",
        openPopup() {},
      });

      expect(menuEntry.ensureEntryMounted()).toEqual({
        ok: true,
        value: { mounted: true },
      });

      const inserted = domDocument.querySelector("#ac-revisit-menu-entry");
      const userMenu = domDocument.querySelector("#user-menu");
      const contestMenu = domDocument.querySelector("#contest-menu");

      expect(inserted?.parentElement).toBe(userMenu);
      expect(inserted?.parentElement).not.toBe(contestMenu);
    });

    test("keeps trailing divider before logout so external scripts using divider anchors remain compatible", () => {
      setDocument(
        `
          <nav class="navbar">
            <ul class="navbar-right">
              <li class="dropdown">
                <a class="dropdown-toggle">tourist</a>
                <ul class="dropdown-menu">
                  <li><a href="/users/tourist">プロフィール</a></li>
                  <li><a href="/settings"><span class="glyphicon glyphicon-wrench"></span> 基本設定</a></li>
                  <li id="predictor-item"><a href="#" id="ac-predictor-settings-dropdown-button">ac-predictor 設定</a></li>
                  <li class="divider" id="logout-divider"></li>
                  <li><a href="javascript:void(form_logout.submit())">ログアウト</a></li>
                </ul>
              </li>
            </ul>
          </nav>
        `,
      );
      const adapter = createAtCoderPageAdapter(domWindow, domDocument);
      const menuEntry = createMenuEntryAdapter({
        pageAdapter: adapter,
        getToday: () => "2026-03-02",
        openPopup() {},
      });

      expect(menuEntry.ensureEntryMounted()).toEqual({
        ok: true,
        value: { mounted: true },
      });

      const menuItems = Array.from(domDocument.querySelectorAll(".dropdown-menu > li")).map(
        (item) =>
          item.id === "ac-revisit-menu-entry" ? "ac-revisit" : item.id || item.textContent?.trim(),
      );
      const inserted = domDocument.querySelector<HTMLLIElement>("#ac-revisit-menu-entry");

      expect(menuItems).toEqual([
        "プロフィール",
        "基本設定",
        "predictor-item",
        "ac-revisit",
        "logout-divider",
        "ログアウト",
      ]);
      expect(inserted?.classList.contains("divider")).toBe(false);
    });

    test("does not convert ac-revisit entry into divider even when mounted after predictor insertion", () => {
      setDocument(
        `
          <nav class="navbar">
            <ul class="navbar-right">
              <li class="dropdown">
                <a class="dropdown-toggle">tourist</a>
                <ul class="dropdown-menu">
                  <li><a href="/users/tourist">プロフィール</a></li>
                  <li><a href="/settings"><span class="glyphicon glyphicon-wrench"></span> 基本設定</a></li>
                  <li><a id="ac-predictor-settings-dropdown-button" href="#">ac-predictor 設定</a></li>
                  <li class="divider"></li>
                  <li><a href="javascript:void(form_logout.submit())">ログアウト</a></li>
                </ul>
              </li>
            </ul>
          </nav>
        `,
      );
      const adapter = createAtCoderPageAdapter(domWindow, domDocument);
      const menuEntry = createMenuEntryAdapter({
        pageAdapter: adapter,
        getToday: () => "2026-03-02",
        openPopup() {},
      });

      expect(menuEntry.ensureEntryMounted()).toEqual({
        ok: true,
        value: { mounted: true },
      });

      const inserted = domDocument.querySelector<HTMLLIElement>("#ac-revisit-menu-entry");
      const predictor = domDocument.querySelector("#ac-predictor-settings-dropdown-button");
      const dividerCount = domDocument.querySelectorAll(".dropdown-menu > li.divider").length;

      expect(inserted).toBeTruthy();
      expect(inserted?.classList.contains("divider")).toBe(false);
      expect(predictor).toBeTruthy();
      expect(dividerCount).toBe(1);
    });
  });

  describe("AtCoderPageAdapter", () => {
    test("reads the problem page context from the canonical heading DOM", () => {
      setDocument(
        problemHeadingHtml("D - Coming of Age Celebration", true),
        "/contests/abc388/tasks/abc388_d",
      );
      const adapter = createAtCoderPageAdapter(domWindow, domDocument);

      expect(adapter.readProblemContextSource()).toEqual({
        kind: "problem",
        pathname: "/contests/abc388/tasks/abc388_d",
        problemTitleText: "D - Coming of Age Celebration",
      });
    });

    test("reads the submission detail context from the task link in the first details table", () => {
      setDocument(submissionDetailHtml(), "/contests/abc388/submissions/61566375");
      const adapter = createAtCoderPageAdapter(domWindow, domDocument);

      expect(adapter.readProblemContextSource()).toEqual({
        kind: "submission_detail",
        taskHref: "/contests/abc388/tasks/abc388_d",
        taskTitleText: "D - Coming of Age Celebration",
      });
    });
  });

  describe("ProblemContextResolver", () => {
    test("normalizes the current problem on both supported contest page shapes", () => {
      setDocument(problemHeadingHtml(), "/contests/abc388/tasks/abc388_d");

      const problemResolver = createProblemContextResolver(
        createAtCoderPageAdapter(domWindow, domDocument),
      );

      expect(problemResolver.resolveCurrentProblem()).toEqual({
        kind: "resolved",
        contestId: "abc388",
        problemId: "abc388/abc388_d",
        problemTitle: "D - Coming of Age Celebration",
      });

      setDocument(submissionDetailHtml(), "/contests/abc388/submissions/61566375");

      const submissionResolver = createProblemContextResolver(
        createAtCoderPageAdapter(domWindow, domDocument),
      );

      expect(submissionResolver.resolveCurrentProblem()).toEqual({
        kind: "resolved",
        contestId: "abc388",
        problemId: "abc388/abc388_d",
        problemTitle: "D - Coming of Age Celebration",
      });
    });
  });

  describe("ToggleMountCoordinator", () => {
    test("mounts one toggle button on the problem page heading anchor", () => {
      setDocument(
        problemHeadingHtml("D - Coming of Age Celebration", true),
        "/contests/abc388/tasks/abc388_d",
      );
      const adapter = createAtCoderPageAdapter(domWindow, domDocument);
      const toggleMount = createToggleMountCoordinator({ pageAdapter: adapter });

      expect(toggleMount.mount()).toEqual({
        ok: true,
        value: {
          mounted: true,
          isRegistered: false,
        },
      });
      expect(toggleMount.mount()).toEqual({
        ok: true,
        value: {
          mounted: false,
          isRegistered: false,
        },
      });

      const button = domDocument.querySelector("#ac-revisit-toggle-button");

      expect(button).toBeTruthy();
      expect(button?.textContent).toBe("ac-revisit 追加");
      expect(button?.getAttribute("data-state")).toBe("unregistered");
      expect(button?.className).toContain("btn-sm");
      expect((button as HTMLButtonElement | null)?.style.marginLeft).toBe("0.5rem");
      expect(domDocument.querySelectorAll("#ac-revisit-toggle-button")).toHaveLength(1);
    });

    test("mounts one toggle button immediately after the submission task link", () => {
      setDocument(submissionDetailHtml(), "/contests/abc388/submissions/61566375");
      const adapter = createAtCoderPageAdapter(domWindow, domDocument);
      const toggleMount = createToggleMountCoordinator({ pageAdapter: adapter });

      expect(toggleMount.mount()).toEqual({
        ok: true,
        value: {
          mounted: true,
          isRegistered: false,
        },
      });

      const button = domDocument.querySelector("#ac-revisit-toggle-button");
      const taskLink = domDocument.querySelector('.col-sm-12 table a[href*="/tasks/"]');
      const heading = domDocument.querySelector(".col-sm-12 p .h2");

      expect(button).toBeTruthy();
      expect(button?.previousElementSibling).toBe(taskLink);
      expect(heading?.nextElementSibling).not.toBe(button);
    });

    test("mounts the toggle immediately after the commentary button on problem pages when it exists", () => {
      setDocument(
        problemHeadingHtml("D - Coming of Age Celebration", true),
        "/contests/abc388/tasks/abc388_d",
      );
      const adapter = createAtCoderPageAdapter(domWindow, domDocument);
      const toggleMount = createToggleMountCoordinator({ pageAdapter: adapter });

      expect(toggleMount.mount()).toEqual({
        ok: true,
        value: {
          mounted: true,
          isRegistered: false,
        },
      });

      const button = domDocument.querySelector("#ac-revisit-toggle-button");
      const commentaryLink = domDocument.querySelector(".col-sm-12 > span.h2 > a.btn");

      expect(button).toBeTruthy();
      expect(button?.previousElementSibling).toBe(commentaryLink);
    });

    test("fails closed when the problem context cannot be resolved", () => {
      setDocument(
        `
          <div class="col-sm-12">
            <span class="h2"></span>
          </div>
        `,
        "/contests/abc388/tasks/abc388_d",
      );
      const adapter = createAtCoderPageAdapter(domWindow, domDocument);
      const toggleMount = createToggleMountCoordinator({ pageAdapter: adapter });

      expect(toggleMount.mount()).toEqual({
        ok: false,
        error: { kind: "problem_unresolvable" },
      });
      expect(domDocument.querySelector("#ac-revisit-toggle-button")).toBeNull();
    });

    test("returns anchor_missing when no supported toggle anchor exists", () => {
      setDocument(
        `
          <div class="col-sm-12">
            <div>D - Coming of Age Celebration</div>
          </div>
        `,
        "/contests/abc388/tasks/abc388_d",
      );
      const adapter = createAtCoderPageAdapter(domWindow, domDocument);
      const toggleMount = createToggleMountCoordinator({ pageAdapter: adapter });

      expect(toggleMount.mount()).toEqual({
        ok: false,
        error: { kind: "anchor_missing" },
      });
    });

    test("updates the toggle state through the provided click handler", () => {
      setDocument(problemHeadingHtml(), "/contests/abc388/tasks/abc388_d");
      const adapter = createAtCoderPageAdapter(domWindow, domDocument);
      const toggleCalls: ToggleInteractionInput[] = [];
      let registered = false;
      const toggleMount = createToggleMountCoordinator({
        pageAdapter: adapter,
        getToday: () => "2026-03-02",
        resolveIsRegistered(problemId) {
          expect(problemId).toBe("abc388/abc388_d");
          return registered;
        },
        onToggle(input) {
          toggleCalls.push(input);
          registered = !input.isRegistered;
          return registered;
        },
      });

      expect(toggleMount.mount()).toEqual({
        ok: true,
        value: {
          mounted: true,
          isRegistered: false,
        },
      });

      const button = domDocument.querySelector("#ac-revisit-toggle-button");
      expect(button).toBeTruthy();

      button?.dispatchEvent(new domWindow.MouseEvent("click", { bubbles: true, cancelable: true }));

      expect(toggleCalls).toEqual([
        {
          isRegistered: false,
          problemId: "abc388/abc388_d",
          problemTitle: "D - Coming of Age Celebration",
          today: "2026-03-02",
        },
      ]);
      expect(button?.getAttribute("data-state")).toBe("registered");
      expect(button?.textContent).toBe("ac-revisit 解除");
    });
  });
});
