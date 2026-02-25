export const STORAGE_KEYS = {
  reviewItems: 'ac-revisit.reviewItems',
  currentSuggestion: 'ac-revisit.currentSuggestion',
  dailyState: 'ac-revisit.dailyState',
  meta: 'ac-revisit.meta',
};

function ok() {
  return { ok: true };
}

function ng(error) {
  return { ok: false, error };
}

export function createStoragePort(adapter) {
  return {
    read(key, fallback) {
      try {
        return adapter.getValue(key, fallback);
      } catch {
        return fallback;
      }
    },
    write(key, value) {
      try {
        adapter.setValue(key, value);
        return ok();
      } catch (error) {
        return ng(error);
      }
    },
    remove(key) {
      try {
        adapter.deleteValue(key);
        return ok();
      } catch (error) {
        return ng(error);
      }
    },
  };
}

export function createReviewItemsStore(storage) {
  return {
    getAll() {
      return storage.read(STORAGE_KEYS.reviewItems, []);
    },
    saveAll(items) {
      return storage.write(STORAGE_KEYS.reviewItems, items);
    },
  };
}

export function createCurrentSuggestionStore(storage) {
  return {
    get() {
      return storage.read(STORAGE_KEYS.currentSuggestion, null);
    },
    set(value) {
      return storage.write(STORAGE_KEYS.currentSuggestion, value);
    },
    clear() {
      return storage.remove(STORAGE_KEYS.currentSuggestion);
    },
  };
}

export function createDailyStateStore(storage) {
  return {
    get() {
      return storage.read(STORAGE_KEYS.dailyState, {});
    },
    set(value) {
      return storage.write(STORAGE_KEYS.dailyState, value);
    },
  };
}

export function createMetaStore(storage, { schemaVersion = 1 } = {}) {
  const defaults = {
    schemaVersion,
    needsIntegrityRepair: false,
  };

  function normalizeMeta(value) {
    const merged = { ...defaults, ...(value ?? {}) };
    return {
      schemaVersion: merged.schemaVersion,
      needsIntegrityRepair: Boolean(merged.needsIntegrityRepair),
    };
  }

  return {
    get() {
      return normalizeMeta(storage.read(STORAGE_KEYS.meta, defaults));
    },
    set(meta) {
      return storage.write(STORAGE_KEYS.meta, normalizeMeta(meta));
    },
    markNeedsIntegrityRepair(flag = true) {
      const meta = this.get();
      return this.set({ ...meta, needsIntegrityRepair: Boolean(flag) });
    },
  };
}
