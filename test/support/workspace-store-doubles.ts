import type { Result, ReviewWorkspace } from "../../src/shared/types.ts";

type StorageUnavailableError = { readonly kind: "storage_unavailable" };

/**
 * Creates an in-memory ReviewStore-like double for domain service tests.
 */
export function createWorkspaceStoreDouble(
  workspace: ReviewWorkspace,
  {
    failOnRead = false,
    failOnWrite = false,
    persistedWorkspaceOnWrite = null,
  }: {
    failOnRead?: boolean;
    failOnWrite?: boolean;
    persistedWorkspaceOnWrite?: ReviewWorkspace | null;
  } = {},
) {
  let currentWorkspace = workspace;
  const writes: ReviewWorkspace[] = [];

  return {
    store: {
      readWorkspace(): Result<ReviewWorkspace, StorageUnavailableError> {
        if (failOnRead) {
          return { ok: false, error: { kind: "storage_unavailable" } };
        }

        return { ok: true, value: currentWorkspace };
      },
      writeWorkspace(nextWorkspace: ReviewWorkspace): Result<ReviewWorkspace, StorageUnavailableError> {
        writes.push(nextWorkspace);

        if (failOnWrite) {
          return { ok: false, error: { kind: "storage_unavailable" } };
        }

        currentWorkspace = persistedWorkspaceOnWrite ?? nextWorkspace;
        return { ok: true, value: currentWorkspace };
      },
    },
    writes,
    getWorkspace() {
      return currentWorkspace;
    },
  };
}
