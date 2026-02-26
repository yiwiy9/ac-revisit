import test from 'node:test';
import assert from 'node:assert/strict';

import { createBookmarkController } from '../src/bookmark-controller.js';

function createReviewItemsStore(seed = []) {
  let items = [...seed];
  return {
    getAll() {
      return [...items];
    },
    saveAll(next) {
      items = [...next];
      return { ok: true };
    },
  };
}

function createCurrentSuggestionStore(seed = null) {
  let current = seed;
  return {
    get() {
      return current;
    },
    clear() {
      current = null;
      return { ok: true };
    },
  };
}

function createBookmarkView() {
  const calls = [];
  return {
    renderToggle(input) {
      calls.push(input);
    },
    calls,
  };
}

test('問題ページでは登録状態に応じてトグルを描画する', () => {
  const reviewItemsStore = createReviewItemsStore([{ problemId: 'abc100_a', registeredAt: '2026-02-01' }]);
  const bookmarkView = createBookmarkView();
  const controller = createBookmarkController({
    reviewItemsStore,
    bookmarkView,
    getTodayLocalDate: () => '2026-02-26',
  });

  const outcome = controller.mount({
    pageContext: { isSupported: true, pageType: 'problem' },
    locationHref: 'https://atcoder.jp/contests/abc100/tasks/abc100_a',
  });

  assert.equal(outcome.rendered, true);
  assert.equal(bookmarkView.calls.length, 1);
  assert.equal(bookmarkView.calls[0].problemId, 'abc100_a');
  assert.equal(bookmarkView.calls[0].isRegistered, true);
});

test('問題ページで未登録問題をトグルすると登録して即時反映する', () => {
  const reviewItemsStore = createReviewItemsStore();
  const bookmarkView = createBookmarkView();
  const controller = createBookmarkController({
    reviewItemsStore,
    bookmarkView,
    getTodayLocalDate: () => '2026-02-26',
  });

  controller.mount({
    pageContext: { isSupported: true, pageType: 'problem' },
    locationHref: 'https://atcoder.jp/contests/abc100/tasks/abc100_a',
  });

  assert.equal(bookmarkView.calls.length, 1);
  assert.equal(bookmarkView.calls[0].isRegistered, false);

  const toggleResult = bookmarkView.calls[0].onToggle();
  assert.equal(toggleResult.ok, true);
  assert.equal(toggleResult.changed, true);

  const storedItems = reviewItemsStore.getAll();
  assert.deepEqual(storedItems, [{ problemId: 'abc100_a', registeredAt: '2026-02-26' }]);

  assert.equal(bookmarkView.calls.length, 2);
  assert.equal(bookmarkView.calls[1].isRegistered, true);
});

test('提出詳細ページでも問題IDがあればトグルを描画する', () => {
  const reviewItemsStore = createReviewItemsStore([{ problemId: 'abc100_a', registeredAt: '2026-02-01' }]);
  const bookmarkView = createBookmarkView();
  const controller = createBookmarkController({
    reviewItemsStore,
    bookmarkView,
    getTodayLocalDate: () => '2026-02-26',
  });

  const outcome = controller.mount({
    pageContext: { isSupported: true, pageType: 'submission-detail', problemId: 'abc100_a' },
    locationHref: 'https://atcoder.jp/contests/abc100/submissions/12345678',
  });

  assert.equal(outcome.rendered, true);
  assert.equal(outcome.problemId, 'abc100_a');
  assert.equal(bookmarkView.calls.length, 1);
  assert.equal(bookmarkView.calls[0].isRegistered, true);
});

test('登録済み問題をトグルすると復習対象から削除し currentSuggestion もクリアする', () => {
  const reviewItemsStore = createReviewItemsStore([{ problemId: 'abc100_a', registeredAt: '2026-02-01' }]);
  const currentSuggestionStore = createCurrentSuggestionStore({ problemId: 'abc100_a', status: 'active' });
  const bookmarkView = createBookmarkView();
  const controller = createBookmarkController({
    reviewItemsStore,
    currentSuggestionStore,
    bookmarkView,
    getTodayLocalDate: () => '2026-02-26',
  });

  controller.mount({
    pageContext: { isSupported: true, pageType: 'problem' },
    locationHref: 'https://atcoder.jp/contests/abc100/tasks/abc100_a',
  });

  const toggleResult = bookmarkView.calls[0].onToggle();
  assert.equal(toggleResult.ok, true);
  assert.equal(toggleResult.changed, true);
  assert.deepEqual(reviewItemsStore.getAll(), []);
  assert.equal(currentSuggestionStore.get(), null);
  assert.equal(bookmarkView.calls[1].isRegistered, false);
});
