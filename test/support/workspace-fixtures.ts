import type { ReviewWorkspace } from "../../src/shared/types.ts";

/** Returns the canonical empty review workspace used in state-transition tests. */
export function createWorkspace(overrides: Partial<ReviewWorkspace> = {}): ReviewWorkspace {
  return {
    reviewItems: [],
    dailyState: {
      activeProblemId: null,
      status: "complete",
      lastDailyEvaluatedOn: null,
    },
    ...overrides,
  };
}
