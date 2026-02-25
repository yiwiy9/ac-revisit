import test from 'node:test';
import assert from 'node:assert/strict';

import {
  STORAGE_KEYS,
  createStoragePort,
  createReviewItemsStore,
  createCurrentSuggestionStore,
  createDailyStateStore,
  createMetaStore,
} from '../src/storage.js';

function createMemoryAdapter(seed = {}) {
  const data = new Map(Object.entries(seed));

  return {
    getValue(key, fallback) {
      return data.has(key) ? data.get(key) : fallback;
    },
    setValue(key, value) {
      data.set(key, value);
    },
    deleteValue(key) {
      data.delete(key);
    },
    snapshot() {
      return Object.fromEntries(data.entries());
    },
  };
}

test('StoragePort はキーごとに読み書きできる', () => {
  const adapter = createMemoryAdapter();
  const storage = createStoragePort(adapter);

  assert.equal(storage.write(STORAGE_KEYS.reviewItems, [{ problemId: 'abc100_a' }]).ok, true);
  assert.equal(storage.write(STORAGE_KEYS.currentSuggestion, { problemId: 'abc100_a' }).ok, true);
  assert.equal(storage.write(STORAGE_KEYS.dailyState, { lastSelectionDate: '2026-02-25' }).ok, true);
  assert.equal(storage.write(STORAGE_KEYS.meta, { schemaVersion: 2, needsIntegrityRepair: true }).ok, true);

  const snap = adapter.snapshot();
  assert.deepEqual(snap[STORAGE_KEYS.reviewItems], [{ problemId: 'abc100_a' }]);
  assert.deepEqual(snap[STORAGE_KEYS.currentSuggestion], { problemId: 'abc100_a' });
  assert.deepEqual(snap[STORAGE_KEYS.dailyState], { lastSelectionDate: '2026-02-25' });
  assert.deepEqual(snap[STORAGE_KEYS.meta], { schemaVersion: 2, needsIntegrityRepair: true });
});

test('StoragePort は read 失敗時に fallback を返して継続する', () => {
  const storage = createStoragePort({
    getValue() {
      throw new Error('broken get');
    },
    setValue() {},
    deleteValue() {},
  });

  const fallback = { safe: true };
  assert.deepEqual(storage.read('any.key', fallback), fallback);
});

test('各ストアは既定値へフォールバックする', () => {
  const storage = createStoragePort({
    getValue() {
      throw new Error('broken get');
    },
    setValue() {},
    deleteValue() {},
  });

  const reviewStore = createReviewItemsStore(storage);
  const currentStore = createCurrentSuggestionStore(storage);
  const dailyStore = createDailyStateStore(storage);
  const metaStore = createMetaStore(storage, { schemaVersion: 3 });

  assert.deepEqual(reviewStore.getAll(), []);
  assert.equal(currentStore.get(), null);
  assert.deepEqual(dailyStore.get(), {});
  assert.deepEqual(metaStore.get(), { schemaVersion: 3, needsIntegrityRepair: false });
});

test('MetaStore は schemaVersion と needsIntegrityRepair を管理できる', () => {
  const adapter = createMemoryAdapter();
  const storage = createStoragePort(adapter);
  const metaStore = createMetaStore(storage, { schemaVersion: 5 });

  assert.deepEqual(metaStore.get(), { schemaVersion: 5, needsIntegrityRepair: false });

  assert.equal(metaStore.markNeedsIntegrityRepair(true).ok, true);
  assert.deepEqual(metaStore.get(), { schemaVersion: 5, needsIntegrityRepair: true });

  assert.equal(metaStore.markNeedsIntegrityRepair(false).ok, true);
  assert.deepEqual(metaStore.get(), { schemaVersion: 5, needsIntegrityRepair: false });
});
