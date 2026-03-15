import type { LocalDateMath } from "../shared/date.ts";
import type { CandidateSelectionService } from "./candidate-selection";
import type { LocalDateKey, Result, ReviewWorkspace } from "../shared/types.ts";

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
  candidateSelectionService,
}: {
  reviewStore: DailySuggestionStore;
  localDateMath: LocalDateMath;
  candidateSelectionService: CandidateSelectionService;
}): DailySuggestionService {
  return {
    ensureTodaySuggestion(input) {
      const latestWorkspace = reviewStore.readWorkspace();

      if (!latestWorkspace.ok) {
        return latestWorkspace;
      }

      if (
        localDateMath.isSameDay(latestWorkspace.value.dailyState.lastDailyEvaluatedOn, input.today)
      ) {
        return success(latestWorkspace.value, false);
      }

      const nextCandidate = candidateSelectionService.pickOneCandidate({
        today: input.today,
        reviewItems: latestWorkspace.value.reviewItems,
      });
      const nextDailyState = nextCandidate.ok
        ? {
            activeProblemId: nextCandidate.value.problemId,
            status: "incomplete" as const,
            lastDailyEvaluatedOn: input.today,
          }
        : {
            activeProblemId: null,
            status: "complete" as const,
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
          localDateMath.isSameDay(
            persistedWorkspace.value.dailyState.lastDailyEvaluatedOn,
            input.today,
          ),
      );
    },
  };
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
