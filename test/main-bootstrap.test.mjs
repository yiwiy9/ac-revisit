import assert from "node:assert/strict";
import { test } from "vitest";

import { bootstrapUserscript } from "../src/main.ts";

const domWindow = globalThis.window;
const domDocument = globalThis.document;

function setDocument(html, pathname = "/") {
  domDocument.body.innerHTML = html;
  domWindow.history.replaceState({}, "", pathname);
}

function createStorageDouble() {
  const values = new Map();

  return {
    storage: {
      get(key) {
        return values.has(key) ? values.get(key) : null;
      },
      set(key, value) {
        values.set(key, value);
      },
    },
  };
}

test("bootstrapUserscript mounts the persistent menu entry only for authenticated sessions", () => {
  const storageDouble = createStorageDouble();

  setDocument(`
    <nav class="navbar">
      <ul class="navbar-right">
        <li><a href="/login">ログイン</a></li>
      </ul>
    </nav>
  `);

  assert.equal(domDocument.querySelector("#ac-revisit-menu-entry"), null);
  assert.deepEqual(bootstrapUserscript({ reviewStorage: storageDouble.storage }), {
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

  const rerunResult = bootstrapUserscript({ reviewStorage: storageDouble.storage });

  assert.deepEqual(rerunResult, {
    session: "authenticated",
    menuEntryMounted: true,
    toggleMounted: true,
  });
  assert.equal(domDocument.querySelector("#ac-revisit-menu-entry-link")?.textContent, "ac-revisit 操作");
  assert.equal(domDocument.querySelector("#ac-revisit-toggle-button")?.textContent, "復習対象に追加");
});

test("bootstrapUserscript wires the toggle button to persisted review registration", () => {
  const storageDouble = createStorageDouble();

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

  bootstrapUserscript({ reviewStorage: storageDouble.storage });

  const button = domDocument.querySelector("#ac-revisit-toggle-button");
  assert.ok(button);
  assert.equal(button.textContent, "復習対象に追加");

  button.dispatchEvent(new domWindow.MouseEvent("click", { bubbles: true, cancelable: true }));

  assert.equal(button.textContent, "復習対象から解除");

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

  bootstrapUserscript({ reviewStorage: storageDouble.storage });

  const rerenderedButton = domDocument.querySelector("#ac-revisit-toggle-button");
  assert.ok(rerenderedButton);
  assert.equal(rerenderedButton.textContent, "復習対象から解除");

  rerenderedButton.dispatchEvent(
    new domWindow.MouseEvent("click", { bubbles: true, cancelable: true }),
  );

  assert.equal(rerenderedButton.textContent, "復習対象に追加");
});
