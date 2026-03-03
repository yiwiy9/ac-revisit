/**
 * Creates an in-memory key-value storage double with optional read/write failures.
 */
export function createMemoryStorageDouble({
  initialValue = null,
  failOnRead = false,
  failOnWrite = false,
}: {
  initialValue?: string | null;
  failOnRead?: boolean;
  failOnWrite?: boolean;
} = {}) {
  let storedValue = initialValue;
  const reads: string[] = [];
  const writes: Array<{ key: string; value: string }> = [];
  const values = new Map<string, string>();

  if (initialValue !== null) {
    values.set("__single__", initialValue);
  }

  return {
    storage: {
      get(key: string): string | null {
        reads.push(key);

        if (failOnRead) {
          throw new Error("read failed");
        }

        if (values.has(key)) {
          return values.get(key) ?? null;
        }

        if (values.has("__single__")) {
          return values.get("__single__") ?? null;
        }

        return storedValue;
      },
      set(key: string, value: string): void {
        writes.push({ key, value });

        if (failOnWrite) {
          throw new Error("write failed");
        }

        storedValue = value;
        values.delete("__single__");
        values.set(key, value);
      },
    },
    reads,
    writes,
    values,
    getStoredValue() {
      return storedValue;
    },
  };
}
