const STORAGE_PROBE_KEY = "ac-revisit:toolchain-probe";

export interface UserscriptStorageProbe {
  read(): string | null;
  write(value: string): void;
}

export function createUserscriptStorageProbe(): UserscriptStorageProbe {
  return {
    read() {
      return GM_getValue<string | null>(STORAGE_PROBE_KEY, null);
    },
    write(value) {
      return GM_setValue(STORAGE_PROBE_KEY, value);
    },
  };
}
