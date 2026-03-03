import { createLocalDateMath, type LocalDateMath } from "../shared/date";
import type { DailySuggestionState, LocalDateKey } from "../shared/types.ts";

export interface InteractionSessionValidationInput {
  readonly expectedDailyState: DailySuggestionState;
  readonly actualDailyState: DailySuggestionState;
  readonly today: LocalDateKey;
}

export type InteractionSessionValidationResult =
  | { readonly kind: "valid" }
  | { readonly kind: "stale" };

export interface InteractionSessionValidator {
  validate(
    input: InteractionSessionValidationInput,
  ): InteractionSessionValidationResult;
}

export function createInteractionSessionValidator({
  localDateMath = createLocalDateMath(),
}: {
  localDateMath?: LocalDateMath;
} = {}): InteractionSessionValidator {
  return {
    validate(input) {
      const statesMatch =
        input.expectedDailyState.activeProblemId ===
          input.actualDailyState.activeProblemId &&
        input.expectedDailyState.status === input.actualDailyState.status &&
        input.expectedDailyState.lastDailyEvaluatedOn ===
          input.actualDailyState.lastDailyEvaluatedOn;

      if (!statesMatch) {
        return { kind: "stale" };
      }

      if (
        !localDateMath.isSameDay(
          input.actualDailyState.lastDailyEvaluatedOn,
          input.today,
        )
      ) {
        return { kind: "stale" };
      }

      return { kind: "valid" };
    },
  };
}
