import { createLocalDateMath, type LocalDateMath } from "../shared/date";
import type { LocalDateKey, Result, ReviewItem } from "../shared/types.ts";

export interface CandidateQuery {
  readonly today: LocalDateKey;
  readonly reviewItems: readonly ReviewItem[];
}

export type CandidateSelectionError = { readonly kind: "no_due_candidates" };

export interface CandidateSelectionService {
  listDueCandidates(input: CandidateQuery): readonly ReviewItem[];
  pickOneCandidate(input: CandidateQuery): Result<ReviewItem, CandidateSelectionError>;
}

export function createCandidateSelectionService({
  localDateMath = createLocalDateMath(),
  random = Math.random,
}: {
  localDateMath?: LocalDateMath;
  random?: () => number;
} = {}): CandidateSelectionService {
  return {
    listDueCandidates(input) {
      return input.reviewItems.filter((item) =>
        localDateMath.isDue(item.registeredOn, input.today),
      );
    },
    pickOneCandidate(input) {
      const dueCandidates = this.listDueCandidates(input);

      if (dueCandidates.length === 0) {
        return {
          ok: false,
          error: { kind: "no_due_candidates" },
        };
      }

      const index = Math.min(dueCandidates.length - 1, Math.floor(random() * dueCandidates.length));

      return {
        ok: true,
        value: dueCandidates[index],
      };
    },
  };
}
