import {
  createCandidateSelectionService,
  type CandidateSelectionService,
} from "./candidate-selection";
import {
  createInteractionSessionValidator,
  type InteractionSessionValidator,
} from "./interaction-session";
import type {
  DailySuggestionState,
  LocalDateKey,
  ProblemId,
  ProblemTitle,
  Result,
  ReviewWorkspace,
} from "../shared/types.ts";

export interface ReviewMutationStore {
  readWorkspace(): Result<ReviewWorkspace, MutationError>;
  writeWorkspace(input: ReviewWorkspace): Result<ReviewWorkspace, MutationError>;
}

export interface RegisterProblemInput {
  readonly problemId: ProblemId;
  readonly problemTitle: ProblemTitle;
  readonly today: LocalDateKey;
}

export interface UnregisterProblemInput {
  readonly problemId: ProblemId;
  readonly today: LocalDateKey;
}

export interface CompleteTodayProblemInput {
  readonly today: LocalDateKey;
  readonly expectedDailyState: DailySuggestionState;
}

export interface FetchNextTodayProblemInput {
  readonly today: LocalDateKey;
  readonly expectedDailyState: DailySuggestionState;
}

export interface MutationOutcome {
  readonly reviewWorkspace: ReviewWorkspace;
}

export type MutationError =
  | { readonly kind: "problem_context_missing" }
  | { readonly kind: "today_problem_absent" }
  | { readonly kind: "today_problem_incomplete" }
  | { readonly kind: "candidate_unavailable" }
  | { readonly kind: "stale_session" }
  | { readonly kind: "storage_unavailable" };

export interface ReviewMutationService {
  registerProblem(input: RegisterProblemInput): Result<MutationOutcome, MutationError>;
  unregisterProblem(input: UnregisterProblemInput): Result<MutationOutcome, MutationError>;
  completeTodayProblem(input: CompleteTodayProblemInput): Result<MutationOutcome, MutationError>;
  fetchNextTodayProblem(input: FetchNextTodayProblemInput): Result<MutationOutcome, MutationError>;
}

export function createReviewMutationService({
  reviewStore,
  candidateSelectionService = createCandidateSelectionService(),
  interactionSessionValidator = createInteractionSessionValidator(),
}: {
  reviewStore: ReviewMutationStore;
  candidateSelectionService?: CandidateSelectionService;
  interactionSessionValidator?: InteractionSessionValidator;
}): ReviewMutationService {
  return {
    registerProblem(input) {
      const latestWorkspace = readLatestWorkspace(reviewStore);

      if (!latestWorkspace.ok) {
        return latestWorkspace;
      }

      const alreadyTracked = latestWorkspace.value.reviewItems.some(
        (item) => item.problemId === input.problemId,
      );

      if (alreadyTracked) {
        return success(latestWorkspace.value);
      }

      return writeWorkspace(reviewStore, {
        reviewItems: [
          ...latestWorkspace.value.reviewItems,
          {
            problemId: input.problemId,
            problemTitle: input.problemTitle,
            registeredOn: input.today,
          },
        ],
        dailyState: latestWorkspace.value.dailyState,
      });
    },
    unregisterProblem(input) {
      const latestWorkspace = readLatestWorkspace(reviewStore);

      if (!latestWorkspace.ok) {
        return latestWorkspace;
      }

      const targetExists = latestWorkspace.value.reviewItems.some(
        (item) => item.problemId === input.problemId,
      );

      if (!targetExists) {
        return success(latestWorkspace.value);
      }

      const reviewItems = latestWorkspace.value.reviewItems.filter(
        (item) => item.problemId !== input.problemId,
      );
      const isActiveProblem = latestWorkspace.value.dailyState.activeProblemId === input.problemId;
      return writeWorkspace(reviewStore, {
        reviewItems,
        dailyState: isActiveProblem
          ? {
              activeProblemId: null,
              status: "complete",
              lastDailyEvaluatedOn: latestWorkspace.value.dailyState.lastDailyEvaluatedOn,
            }
          : latestWorkspace.value.dailyState,
      });
    },
    completeTodayProblem(input) {
      const latestWorkspace = readLatestWorkspace(reviewStore);

      if (!latestWorkspace.ok) {
        return latestWorkspace;
      }

      if (
        interactionSessionValidator.validate({
          expectedDailyState: input.expectedDailyState,
          actualDailyState: latestWorkspace.value.dailyState,
          today: input.today,
        }).kind === "stale"
      ) {
        return failure({ kind: "stale_session" });
      }

      const activeProblemId = latestWorkspace.value.dailyState.activeProblemId;

      if (latestWorkspace.value.dailyState.status !== "incomplete" || activeProblemId === null) {
        return failure({ kind: "today_problem_absent" });
      }

      const activeProblem = latestWorkspace.value.reviewItems.find(
        (item) => item.problemId === activeProblemId,
      );

      if (activeProblem === undefined) {
        return failure({ kind: "today_problem_absent" });
      }

      const reviewItems = latestWorkspace.value.reviewItems
        .filter((item) => item.problemId !== activeProblem.problemId)
        .concat({
          problemId: activeProblem.problemId,
          problemTitle: activeProblem.problemTitle,
          registeredOn: input.today,
        });

      return writeWorkspace(reviewStore, {
        reviewItems,
        dailyState: {
          activeProblemId: null,
          status: "complete",
          lastDailyEvaluatedOn: latestWorkspace.value.dailyState.lastDailyEvaluatedOn,
        },
      });
    },
    fetchNextTodayProblem(input) {
      const latestWorkspace = readLatestWorkspace(reviewStore);

      if (!latestWorkspace.ok) {
        return latestWorkspace;
      }

      if (
        interactionSessionValidator.validate({
          expectedDailyState: input.expectedDailyState,
          actualDailyState: latestWorkspace.value.dailyState,
          today: input.today,
        }).kind === "stale"
      ) {
        return failure({ kind: "stale_session" });
      }

      if (latestWorkspace.value.dailyState.status !== "complete") {
        return failure({ kind: "today_problem_incomplete" });
      }

      const nextCandidate = candidateSelectionService.pickOneCandidate({
        today: input.today,
        reviewItems: latestWorkspace.value.reviewItems,
      });

      if (!nextCandidate.ok) {
        return failure({ kind: "candidate_unavailable" });
      }

      return writeWorkspace(reviewStore, {
        reviewItems: latestWorkspace.value.reviewItems,
        dailyState: {
          activeProblemId: nextCandidate.value.problemId,
          status: "incomplete",
          lastDailyEvaluatedOn: latestWorkspace.value.dailyState.lastDailyEvaluatedOn,
        },
      });
    },
  };
}

function readLatestWorkspace(
  reviewStore: ReviewMutationStore,
): Result<ReviewWorkspace, MutationError> {
  const result = reviewStore.readWorkspace();

  if (!result.ok) {
    return {
      ok: false,
      error: result.error,
    };
  }

  return result;
}

function writeWorkspace(
  reviewStore: ReviewMutationStore,
  reviewWorkspace: ReviewWorkspace,
): Result<MutationOutcome, MutationError> {
  const result = reviewStore.writeWorkspace(reviewWorkspace);

  if (!result.ok) {
    return failure(result.error);
  }

  return success(result.value);
}

function success(reviewWorkspace: ReviewWorkspace): Result<MutationOutcome, MutationError> {
  return {
    ok: true,
    value: {
      reviewWorkspace,
    },
  };
}

function failure(error: MutationError): Result<MutationOutcome, MutationError> {
  return {
    ok: false,
    error,
  };
}
