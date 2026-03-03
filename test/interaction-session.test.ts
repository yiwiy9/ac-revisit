import { expect, test } from "vitest";

import { createInteractionSessionValidator } from "../src/domain/interaction-session.ts";

test("InteractionSessionValidator returns valid only when the rendered state still matches today", () => {
  const validator = createInteractionSessionValidator();

  expect(
    validator.validate({
      expectedDailyState: {
        activeProblemId: "abc100/abc100_a",
        status: "incomplete",
        lastDailyEvaluatedOn: "2026-03-02",
      },
      actualDailyState: {
        activeProblemId: "abc100/abc100_a",
        status: "incomplete",
        lastDailyEvaluatedOn: "2026-03-02",
      },
      today: "2026-03-02",
    }),
  ).toEqual({ kind: "valid" });
});

test("InteractionSessionValidator returns stale when the rendered state no longer matches or rolls over to another day", () => {
  const validator = createInteractionSessionValidator();

  expect(
    validator.validate({
      expectedDailyState: {
        activeProblemId: "abc100/abc100_a",
        status: "incomplete",
        lastDailyEvaluatedOn: "2026-03-02",
      },
      actualDailyState: {
        activeProblemId: null,
        status: "complete",
        lastDailyEvaluatedOn: "2026-03-02",
      },
      today: "2026-03-02",
    }),
  ).toEqual({ kind: "stale" });

  expect(
    validator.validate({
      expectedDailyState: {
        activeProblemId: null,
        status: "complete",
        lastDailyEvaluatedOn: "2026-03-01",
      },
      actualDailyState: {
        activeProblemId: null,
        status: "complete",
        lastDailyEvaluatedOn: "2026-03-01",
      },
      today: "2026-03-02",
    }),
  ).toEqual({ kind: "stale" });
});
