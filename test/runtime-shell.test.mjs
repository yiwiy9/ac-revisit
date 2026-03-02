import assert from "node:assert/strict";
import { test } from "vitest";

import {
  createAtCoderPageAdapter,
  createAuthSessionGuard,
  createMenuEntryAdapter,
} from "../src/runtime/shell.ts";

const domWindow = globalThis.window;
const domDocument = globalThis.document;

function setDocument(html, pathname = "/") {
  domDocument.body.innerHTML = html;
  domWindow.history.replaceState({}, "", pathname);
}

test("AuthSessionGuard resolves authenticated on legacy contest pages using the legacy user menu signal", () => {
  setDocument(
    `
      <nav class="navbar">
        <ul class="navbar-right">
          <li class="dropdown">
            <a class="dropdown-toggle">tourist</a>
            <ul class="dropdown-menu">
              <li><a href="/users/tourist">プロフィール</a></li>
            </ul>
          </li>
        </ul>
      </nav>
    `,
    "/contests/abc100/tasks/abc100_a",
  );
  const adapter = createAtCoderPageAdapter(domWindow, domDocument);
  const guard = createAuthSessionGuard(adapter);

  assert.deepEqual(guard.resolveSession(), {
    kind: "authenticated",
    userHandle: "tourist",
  });
});

test("AuthSessionGuard resolves authenticated on the top page using the new mypage signal", () => {
  setDocument(`
    <header id="header">
      <div class="header-mypage">
        <button class="j-dropdown_mypage">tourist</button>
      </div>
      <div class="header-mypage_detail">
        <ul class="header-mypage_list">
          <li><a href="/users/tourist">プロフィール</a></li>
        </ul>
      </div>
    </header>
  `);
  const adapter = createAtCoderPageAdapter(domWindow, domDocument);
  const guard = createAuthSessionGuard(adapter);

  assert.deepEqual(guard.resolveSession(), {
    kind: "authenticated",
    userHandle: "tourist",
  });
});

test("AuthSessionGuard fails closed when no supported header signal exists", () => {
  setDocument(`
    <nav class="navbar">
      <ul class="navbar-right">
        <li><a href="/login">ログイン</a></li>
      </ul>
    </nav>
  `);
  const adapter = createAtCoderPageAdapter(domWindow, domDocument);
  const guard = createAuthSessionGuard(adapter);

  assert.deepEqual(guard.resolveSession(), { kind: "anonymous" });
});

test("MenuEntryAdapter mounts the persistent menu entry once on the legacy menu anchor", () => {
  setDocument(
    `
      <nav class="navbar">
        <ul class="navbar-right">
          <li class="dropdown">
            <a class="dropdown-toggle">tourist</a>
            <ul class="dropdown-menu">
              <li><a href="/users/tourist">プロフィール</a></li>
            </ul>
          </li>
        </ul>
      </nav>
    `,
    "/contests/abc100/tasks/abc100_a",
  );
  const adapter = createAtCoderPageAdapter(domWindow, domDocument);
  const openCalls = [];
  const menuEntry = createMenuEntryAdapter({
    pageAdapter: adapter,
    getToday: () => "2026-03-02",
    openPopup(input) {
      openCalls.push(input);
    },
  });

  assert.deepEqual(menuEntry.ensureEntryMounted(), {
    ok: true,
    value: { mounted: true },
  });
  assert.deepEqual(menuEntry.ensureEntryMounted(), {
    ok: true,
    value: { mounted: false },
  });

  const entry = domDocument.querySelector("#ac-revisit-menu-entry");
  const link = domDocument.querySelector("#ac-revisit-menu-entry-link");

  assert.ok(entry);
  assert.equal(domDocument.querySelectorAll("#ac-revisit-menu-entry").length, 1);
  assert.equal(link?.textContent, "ac-revisit 操作");

  link.dispatchEvent(new domWindow.MouseEvent("click", { bubbles: true, cancelable: true }));

  assert.deepEqual(openCalls, [
    {
      source: "menu",
      today: "2026-03-02",
    },
  ]);
});

test("MenuEntryAdapter mounts the persistent menu entry on the top page new header anchor", () => {
  setDocument(`
    <header id="header">
      <div class="header-mypage">
        <button class="j-dropdown_mypage">tourist</button>
      </div>
      <div class="header-mypage_detail">
        <ul class="header-mypage_list">
          <li><a href="/users/tourist">プロフィール</a></li>
        </ul>
      </div>
    </header>
  `);
  const adapter = createAtCoderPageAdapter(domWindow, domDocument);
  const openCalls = [];
  const menuEntry = createMenuEntryAdapter({
    pageAdapter: adapter,
    getToday: () => "2026-03-02",
    openPopup(input) {
      openCalls.push(input);
    },
  });

  assert.deepEqual(menuEntry.ensureEntryMounted(), {
    ok: true,
    value: { mounted: true },
  });

  const topPageMenu = domDocument.querySelector(".header-mypage_detail .header-mypage_list");
  const entry = domDocument.querySelector("#ac-revisit-menu-entry");
  const link = domDocument.querySelector("#ac-revisit-menu-entry-link");

  assert.ok(topPageMenu);
  assert.equal(entry?.parentElement, topPageMenu);
  assert.equal(link?.textContent, "ac-revisit 操作");

  link.dispatchEvent(new domWindow.MouseEvent("click", { bubbles: true, cancelable: true }));

  assert.deepEqual(openCalls, [
    {
      source: "menu",
      today: "2026-03-02",
    },
  ]);
});

test("MenuEntryAdapter returns anchor_missing when no supported menu anchor exists", () => {
  setDocument(`
    <nav class="navbar">
      <ul class="navbar-right">
        <li><a href="/login">ログイン</a></li>
      </ul>
    </nav>
  `);
  const adapter = createAtCoderPageAdapter(domWindow, domDocument);
  const menuEntry = createMenuEntryAdapter({
    pageAdapter: adapter,
    getToday: () => "2026-03-02",
    openPopup() {
      throw new Error("must not be called");
    },
  });

  assert.deepEqual(menuEntry.ensureEntryMounted(), {
    ok: false,
    error: { kind: "anchor_missing" },
  });
  assert.equal(domDocument.querySelector("#ac-revisit-menu-entry"), null);
});
