import type {
  DailySuggestionState,
  ProblemId,
  ProblemTitle,
  Result,
  ReviewItem,
  ReviewWorkspace,
} from "../shared/types.ts";

const SCHEMA_VERSION = 1;
const PROBLEM_ID_PATTERN = /^[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+$/;
const LOCAL_DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const REVIEW_STORE_KEY = "ac_revisit_workspace_v1";

export interface ReviewStorePort {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

export interface ReviewStoreAdapter {
  readWorkspace(): Result<ReviewWorkspace, StoreError>;
  writeWorkspace(input: ReviewWorkspace): Result<ReviewWorkspace, StoreError>;
}

export type StoreError = { readonly kind: "storage_unavailable" };

interface SchemaEnvelope {
  readonly version: number;
  readonly payload: ReviewWorkspace;
}

export function createCanonicalReviewWorkspace(): ReviewWorkspace {
  return {
    reviewItems: [],
    dailyState: {
      activeProblemId: null,
      status: "complete",
      lastDailyEvaluatedOn: null,
    },
  };
}

export function createReviewStoreAdapter(storage: ReviewStorePort): ReviewStoreAdapter {
  return {
    readWorkspace() {
      let rawValue: string | null;

      try {
        rawValue = storage.get(REVIEW_STORE_KEY);
      } catch {
        return storageUnavailable();
      }

      if (rawValue === null) {
        return success(createCanonicalReviewWorkspace());
      }

      const parsed = parseSchemaEnvelope(rawValue);

      return success(parsed ?? createCanonicalReviewWorkspace());
    },
    writeWorkspace(input) {
      const normalizedWorkspace = normalizeWorkspace(
        validateWorkspace(input) ?? createCanonicalReviewWorkspace(),
      );
      const payload = JSON.stringify({
        version: SCHEMA_VERSION,
        payload: normalizedWorkspace,
      } satisfies SchemaEnvelope);

      try {
        storage.set(REVIEW_STORE_KEY, payload);
      } catch {
        return storageUnavailable();
      }

      return success(normalizedWorkspace);
    },
  };
}

function parseSchemaEnvelope(rawValue: string): ReviewWorkspace | null {
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawValue);
  } catch {
    return null;
  }

  if (!isRecord(parsed)) {
    return null;
  }

  if (parsed.version !== SCHEMA_VERSION) {
    return null;
  }

  return validateWorkspace(parsed.payload);
}

function validateWorkspace(value: unknown): ReviewWorkspace | null {
  if (!isRecord(value)) {
    return null;
  }

  const { reviewItems, dailyState } = value;

  if (!Array.isArray(reviewItems) || !isRecord(dailyState)) {
    return null;
  }

  const normalizedReviewItems: ReviewItem[] = [];
  const knownProblemIds = new Set<ProblemId>();

  for (const item of reviewItems) {
    const normalizedItem = validateReviewItem(item);

    if (normalizedItem === null || knownProblemIds.has(normalizedItem.problemId)) {
      return null;
    }

    knownProblemIds.add(normalizedItem.problemId);
    normalizedReviewItems.push(normalizedItem);
  }

  const normalizedDailyState = validateDailyState(dailyState, knownProblemIds);

  if (normalizedDailyState === null) {
    return null;
  }

  return {
    reviewItems: normalizedReviewItems,
    dailyState: normalizedDailyState,
  };
}

function validateReviewItem(value: unknown): ReviewItem | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    !isProblemId(value.problemId) ||
    !isProblemTitle(value.problemTitle) ||
    !isLocalDateKey(value.registeredOn)
  ) {
    return null;
  }

  return {
    problemId: value.problemId,
    problemTitle: value.problemTitle,
    registeredOn: value.registeredOn,
  };
}

function validateDailyState(
  value: Record<string, unknown>,
  problemIds: ReadonlySet<ProblemId>,
): DailySuggestionState | null {
  const lastDailyEvaluatedOn = value.lastDailyEvaluatedOn;

  if (!(lastDailyEvaluatedOn === null || isLocalDateKey(lastDailyEvaluatedOn))) {
    return null;
  }

  if (value.status === "complete") {
    if (
      value.activeProblemId !== null &&
      (!isProblemId(value.activeProblemId) || !problemIds.has(value.activeProblemId))
    ) {
      return null;
    }

    return {
      activeProblemId: value.activeProblemId,
      status: "complete",
      lastDailyEvaluatedOn,
    };
  }

  if (value.status === "incomplete") {
    if (!isProblemId(value.activeProblemId) || !problemIds.has(value.activeProblemId)) {
      return null;
    }

    return {
      activeProblemId: value.activeProblemId,
      status: "incomplete",
      lastDailyEvaluatedOn,
    };
  }

  return null;
}

function normalizeWorkspace(input: ReviewWorkspace): ReviewWorkspace {
  return {
    reviewItems: [...input.reviewItems]
      .map((item) => ({
        problemId: item.problemId,
        problemTitle: item.problemTitle,
        registeredOn: item.registeredOn,
      }))
      .sort((left, right) => left.problemId.localeCompare(right.problemId)),
    dailyState: {
      activeProblemId: input.dailyState.activeProblemId,
      status: input.dailyState.status,
      lastDailyEvaluatedOn: input.dailyState.lastDailyEvaluatedOn,
    },
  };
}

function isProblemId(value: unknown): value is ProblemId {
  return typeof value === "string" && PROBLEM_ID_PATTERN.test(value);
}

function isProblemTitle(value: unknown): value is ProblemTitle {
  return typeof value === "string" && value.trim().length > 0;
}

function isLocalDateKey(value: unknown): value is string {
  if (typeof value !== "string" || !LOCAL_DATE_KEY_PATTERN.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map((part) => Number(part));
  const date = new Date(Date.UTC(year, month - 1, day));
  const normalized = [
    String(date.getUTCFullYear()).padStart(4, "0"),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");

  return normalized === value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function success(value: ReviewWorkspace): Result<ReviewWorkspace, StoreError> {
  return { ok: true, value };
}

function storageUnavailable(): Result<ReviewWorkspace, StoreError> {
  return { ok: false, error: { kind: "storage_unavailable" } };
}
