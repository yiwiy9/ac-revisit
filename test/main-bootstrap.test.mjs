import assert from "node:assert/strict";
import { test } from "vitest";

import { bootstrapUserscript } from "../src/main.ts";

const domWindow = globalThis.window;
const domDocument = globalThis.document;

function setDocument(html, pathname = "/") {
  domDocument.body.innerHTML = html;
  domWindow.history.replaceState({}, "", pathname);
}

test("bootstrapUserscript mounts the persistent menu entry only for authenticated sessions", () => {
  setDocument(`
    <nav class="navbar">
      <ul class="navbar-right">
        <li><a href="/login">ログイン</a></li>
      </ul>
    </nav>
  `);

  assert.equal(domDocument.querySelector("#ac-revisit-menu-entry"), null);
  assert.deepEqual(bootstrapUserscript(), {
    session: "anonymous",
    menuEntryMounted: false,
    toggleMounted: false,
  });

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
      <div class="col-sm-12">
        <span class="h2">A - Happy Birthday!</span>
      </div>
    `,
    "/contests/abc100/tasks/abc100_a",
  );

  const rerunResult = bootstrapUserscript();

  assert.deepEqual(rerunResult, {
    session: "authenticated",
    menuEntryMounted: true,
    toggleMounted: true,
  });
  assert.equal(domDocument.querySelector("#ac-revisit-menu-entry-link")?.textContent, "ac-revisit 操作");
  assert.equal(domDocument.querySelector("#ac-revisit-toggle-button")?.textContent, "復習対象に追加");
});
