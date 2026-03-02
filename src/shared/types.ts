export type LocalDateKey = string;

export type ContestId = string;
export type TaskId = string;
export type ProblemId = string;
export type ProblemTitle = string;

export interface ReviewItem {
  readonly problemId: ProblemId;
  readonly problemTitle: ProblemTitle;
  readonly registeredOn: LocalDateKey;
}

export interface DailySuggestionState {
  readonly activeProblemId: ProblemId | null;
  readonly status: "incomplete" | "complete";
  readonly lastDailyEvaluatedOn: LocalDateKey | null;
}

export interface ReviewWorkspace {
  readonly reviewItems: readonly ReviewItem[];
  readonly dailyState: DailySuggestionState;
}

export type Result<Value, Error> =
  | {
      readonly ok: true;
      readonly value: Value;
    }
  | {
      readonly ok: false;
      readonly error: Error;
    };
