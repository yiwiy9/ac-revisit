import type { LocalDateMath } from "../shared/date.ts";
import type {
  LocalDateKey,
  Result,
  ReviewItem,
  ReviewWorkspace,
} from "../shared/types.ts";

export interface DailySuggestionStore {
  readWorkspace(): Result<ReviewWorkspace, DailyEntryError>;
  writeWorkspace(input: ReviewWorkspace): Result<ReviewWorkspace, DailyEntryError>;
}

export interface EnsureTodaySuggestionInput {
  readonly today: LocalDateKey;
  readonly trigger: "bootstrap" | "menu";
}

export interface EnsureTodaySuggestionOutcome {
  readonly reviewWorkspace: ReviewWorkspace;
  readonly dailyState: ReviewWorkspace["dailyState"];
  readonly shouldAutoOpenPopup: boolean;
}

export type DailyEntryError = { readonly kind: "storage_unavailable" };

export interface DailySuggestionService {
  ensureTodaySuggestion(
    input: EnsureTodaySuggestionInput,
  ): Result<EnsureTodaySuggestionOutcome, DailyEntryError>;
}

export function createDailySuggestionService({
  reviewStore,
  localDateMath,
  random = Math.random,
}: {
  reviewStore: DailySuggestionStore;
  localDateMath: LocalDateMath;
  random?: () => number;
}): DailySuggestionService {
  return {
    ensureTodaySuggestion(input) {
      const latestWorkspace = reviewStore.readWorkspace();

      if (!latestWorkspace.ok) {
        return latestWorkspace;
      }

      if (localDateMath.isSameDay(latestWorkspace.value.dailyState.lastDailyEvaluatedOn, input.today)) {
        return success(latestWorkspace.value, false);
      }

      const dueCandidates = latestWorkspace.value.reviewItems.filter((item) =>
        localDateMath.isDue(item.registeredOn, input.today),
      );
      const nextDailyState =
        dueCandidates.length === 0
          ? {
              activeProblemId: null,
              status: "complete" as const,
              lastDailyEvaluatedOn: input.today,
            }
          : {
              activeProblemId: pickCandidate(dueCandidates, random).problemId,
              status: "incomplete" as const,
              lastDailyEvaluatedOn: input.today,
            };
      const nextWorkspace: ReviewWorkspace = {
        reviewItems: latestWorkspace.value.reviewItems,
        dailyState: nextDailyState,
      };
      const persistedWorkspace = reviewStore.writeWorkspace(nextWorkspace);

      if (!persistedWorkspace.ok) {
        return persistedWorkspace;
      }

      return success(
        persistedWorkspace.value,
        input.trigger === "bootstrap" &&
          persistedWorkspace.value.dailyState.status === "incomplete" &&
          localDateMath.isSameDay(persistedWorkspace.value.dailyState.lastDailyEvaluatedOn, input.today),
      );
    },
  };
}

function pickCandidate(reviewItems: readonly ReviewItem[], random: () => number): ReviewItem {
  const index = Math.min(reviewItems.length - 1, Math.floor(random() * reviewItems.length));

  return reviewItems[index];
}

function success(
  reviewWorkspace: ReviewWorkspace,
  shouldAutoOpenPopup: boolean,
): Result<EnsureTodaySuggestionOutcome, DailyEntryError> {
  return {
    ok: true,
    value: {
      reviewWorkspace,
      dailyState: reviewWorkspace.dailyState,
      shouldAutoOpenPopup,
    },
  };
}
