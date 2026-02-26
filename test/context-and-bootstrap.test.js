import test from 'node:test';
import assert from 'node:assert/strict';

import { detectPageContext } from '../src/context-adapter.js';
import { initializeForPage } from '../src/bootstrap.js';

function createDocumentStub({ hasUserMenu = false, submissionTaskHref = null } = {}) {
  return {
    querySelector(selector) {
      if (selector === 'a[href^="/users/"]' && hasUserMenu) {
        return { tagName: 'A' };
      }
      if (selector === 'a[href*="/tasks/"]' && submissionTaskHref) {
        return { tagName: 'A', getAttribute: () => submissionTaskHref };
      }
      return null;
    },
  };
}

test('AtCoder かつログイン済みの場合に supported となり pageType を正規化する', () => {
  const context = detectPageContext({
    locationHref: 'https://atcoder.jp/contests/abc100/tasks/abc100_a',
    documentRef: createDocumentStub({ hasUserMenu: true }),
  });

  assert.equal(context.isAtcoder, true);
  assert.equal(context.isLoggedIn, true);
  assert.equal(context.isSupported, true);
  assert.equal(context.pageType, 'problem');
});

test('AtCoder だが未ログインの場合は supported にならない', () => {
  const context = detectPageContext({
    locationHref: 'https://atcoder.jp/contests/abc100/tasks/abc100_a',
    documentRef: createDocumentStub({ hasUserMenu: false }),
  });

  assert.equal(context.isAtcoder, true);
  assert.equal(context.isLoggedIn, false);
  assert.equal(context.isSupported, false);
});

test('AtCoder 以外では early return して機能起動しない', () => {
  let invoked = 0;
  const outcome = initializeForPage({
    locationHref: 'https://example.com/contests/abc100/tasks/abc100_a',
    documentRef: createDocumentStub({ hasUserMenu: true }),
    runReviewFeatures() {
      invoked += 1;
    },
  });

  assert.equal(outcome.initialized, false);
  assert.equal(outcome.reason, 'unsupported-context');
  assert.equal(invoked, 0);
});

test('supported の場合のみ機能起動し、submission-detail を判定できる', () => {
  let invoked = 0;
  const outcome = initializeForPage({
    locationHref: 'https://atcoder.jp/contests/abc100/submissions/12345678',
    documentRef: createDocumentStub({ hasUserMenu: true }),
    runReviewFeatures(context) {
      invoked += 1;
      assert.equal(context.pageType, 'submission-detail');
    },
  });

  assert.equal(outcome.initialized, true);
  assert.equal(invoked, 1);
});

test('提出詳細ページではページ内リンクから問題IDを抽出する', () => {
  const context = detectPageContext({
    locationHref: 'https://atcoder.jp/contests/abc100/submissions/12345678',
    documentRef: createDocumentStub({
      hasUserMenu: true,
      submissionTaskHref: '/contests/abc100/tasks/abc100_a',
    }),
  });

  assert.equal(context.pageType, 'submission-detail');
  assert.equal(context.problemId, 'abc100_a');
});
