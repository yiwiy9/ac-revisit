import assert from "node:assert/strict";
import { test } from "vitest";

import {
  createAtCoderPageAdapter,
  createAuthSessionGuard,
  createMenuEntryAdapter,
  createProblemContextResolver,
  createToggleMountCoordinator,
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

test("AtCoderPageAdapter reads the problem page context from the canonical heading DOM", () => {
  setDocument(
    `
      <div class="col-sm-12">
        <span class="h2">
          D - Coming of Age Celebration
          <a class="btn btn-default btn-sm">解説</a>
        </span>
      </div>
    `,
    "/contests/abc388/tasks/abc388_d",
  );
  const adapter = createAtCoderPageAdapter(domWindow, domDocument);

  assert.deepEqual(adapter.readProblemContextSource(), {
    kind: "problem",
    pathname: "/contests/abc388/tasks/abc388_d",
    problemTitleText: "D - Coming of Age Celebration",
  });
});

test("AtCoderPageAdapter reads the submission detail context from the task link in the first details table", () => {
  setDocument(
    `
      <div class="col-sm-12">
        <p><span class="h2">提出 #61566375</span></p>
        <table class="table table-bordered">
          <tbody>
            <tr>
              <th>問題</th>
              <td>
                <a href="/contests/abc388/tasks/abc388_d">D - Coming of Age Celebration</a>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    `,
    "/contests/abc388/submissions/61566375",
  );
  const adapter = createAtCoderPageAdapter(domWindow, domDocument);

  assert.deepEqual(adapter.readProblemContextSource(), {
    kind: "submission_detail",
    taskHref: "/contests/abc388/tasks/abc388_d",
    taskTitleText: "D - Coming of Age Celebration",
  });
});

test("ProblemContextResolver normalizes the current problem on both supported contest page shapes", () => {
  setDocument(
    `
      <div class="col-sm-12">
        <span class="h2">D - Coming of Age Celebration</span>
      </div>
    `,
    "/contests/abc388/tasks/abc388_d",
  );

  const problemResolver = createProblemContextResolver(
    createAtCoderPageAdapter(domWindow, domDocument),
  );

  assert.deepEqual(problemResolver.resolveCurrentProblem(), {
    kind: "resolved",
    contestId: "abc388",
    problemId: "abc388/abc388_d",
    problemTitle: "D - Coming of Age Celebration",
  });

  setDocument(
    `
      <div class="col-sm-12">
        <p><span class="h2">提出 #61566375</span></p>
        <table class="table table-bordered">
          <tbody>
            <tr>
              <th>問題</th>
              <td>
                <a href="/contests/abc388/tasks/abc388_d">D - Coming of Age Celebration</a>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    `,
    "/contests/abc388/submissions/61566375",
  );

  const submissionResolver = createProblemContextResolver(
    createAtCoderPageAdapter(domWindow, domDocument),
  );

  assert.deepEqual(submissionResolver.resolveCurrentProblem(), {
    kind: "resolved",
    contestId: "abc388",
    problemId: "abc388/abc388_d",
    problemTitle: "D - Coming of Age Celebration",
  });
});

test("ToggleMountCoordinator mounts one toggle button on the problem page heading anchor", () => {
  setDocument(
    `
      <div class="col-sm-12">
        <span class="h2">
          D - Coming of Age Celebration
          <a class="btn btn-default btn-sm">解説</a>
        </span>
      </div>
    `,
    "/contests/abc388/tasks/abc388_d",
  );
  const adapter = createAtCoderPageAdapter(domWindow, domDocument);
  const toggleMount = createToggleMountCoordinator({ pageAdapter: adapter });

  assert.deepEqual(toggleMount.mount(), {
    ok: true,
    value: {
      mounted: true,
      isRegistered: false,
    },
  });
  assert.deepEqual(toggleMount.mount(), {
    ok: true,
    value: {
      mounted: false,
      isRegistered: false,
    },
  });

  const button = domDocument.querySelector("#ac-revisit-toggle-button");

  assert.ok(button);
  assert.equal(button.textContent, "復習対象に追加");
  assert.equal(button.getAttribute("data-state"), "unregistered");
  assert.equal(domDocument.querySelectorAll("#ac-revisit-toggle-button").length, 1);
});

test("ToggleMountCoordinator mounts one toggle button on the submission detail heading anchor", () => {
  setDocument(
    `
      <div class="col-sm-12">
        <p><span class="h2">提出 #61566375</span></p>
        <table class="table table-bordered">
          <tbody>
            <tr>
              <th>問題</th>
              <td>
                <a href="/contests/abc388/tasks/abc388_d">D - Coming of Age Celebration</a>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    `,
    "/contests/abc388/submissions/61566375",
  );
  const adapter = createAtCoderPageAdapter(domWindow, domDocument);
  const toggleMount = createToggleMountCoordinator({ pageAdapter: adapter });

  assert.deepEqual(toggleMount.mount(), {
    ok: true,
    value: {
      mounted: true,
      isRegistered: false,
    },
  });

  const button = domDocument.querySelector("#ac-revisit-toggle-button");
  const heading = domDocument.querySelector(".col-sm-12 > p > span.h2");

  assert.ok(button);
  assert.equal(button.parentElement, heading?.parentElement);
});

test("ToggleMountCoordinator fails closed when the problem context cannot be resolved", () => {
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

  assert.deepEqual(toggleMount.mount(), {
    ok: false,
    error: { kind: "problem_unresolvable" },
  });
  assert.equal(domDocument.querySelector("#ac-revisit-toggle-button"), null);
});

test("ToggleMountCoordinator returns anchor_missing when no supported toggle anchor exists", () => {
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

  assert.deepEqual(toggleMount.mount(), {
    ok: false,
    error: { kind: "anchor_missing" },
  });
});
