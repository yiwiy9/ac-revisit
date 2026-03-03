import { expect, test } from "vitest";

import { createCandidateSelectionService } from "../src/domain/candidate-selection.ts";

test("CandidateSelectionService lists only problems due after the fixed 14-day interval", () => {
  const service = createCandidateSelectionService();

  const result = service.listDueCandidates({
    today: "2026-03-02",
    reviewItems: [
      {
        problemId: "abc100/abc100_a",
        problemTitle: "A - Happy Birthday!",
        registeredOn: "2026-02-17",
      },
      {
        problemId: "abc100/abc100_b",
        problemTitle: "B - Ringo's Favorite Numbers",
        registeredOn: "2026-02-16",
      },
      {
        problemId: "abc100/abc100_c",
        problemTitle: "C - Daydream",
        registeredOn: "2026-02-10",
      },
    ],
  });

  expect(result).toEqual([
    {
      problemId: "abc100/abc100_b",
      problemTitle: "B - Ringo's Favorite Numbers",
      registeredOn: "2026-02-16",
    },
    {
      problemId: "abc100/abc100_c",
      problemTitle: "C - Daydream",
      registeredOn: "2026-02-10",
    },
  ]);
});

test("CandidateSelectionService picks one due problem using the injected RNG", () => {
  const service = createCandidateSelectionService({
    random: () => 0.99,
  });

  const result = service.pickOneCandidate({
    today: "2026-03-02",
    reviewItems: [
      {
        problemId: "abc100/abc100_a",
        problemTitle: "A - Happy Birthday!",
        registeredOn: "2026-02-16",
      },
      {
        problemId: "abc100/abc100_b",
        problemTitle: "B - Ringo's Favorite Numbers",
        registeredOn: "2026-02-10",
      },
    ],
  });

  expect(result).toEqual({
    ok: true,
    value: {
      problemId: "abc100/abc100_b",
      problemTitle: "B - Ringo's Favorite Numbers",
      registeredOn: "2026-02-10",
    },
  });
});

test("CandidateSelectionService returns no_due_candidates when nothing is due", () => {
  const service = createCandidateSelectionService();

  const result = service.pickOneCandidate({
    today: "2026-03-02",
    reviewItems: [
      {
        problemId: "abc100/abc100_a",
        problemTitle: "A - Happy Birthday!",
        registeredOn: "2026-02-18",
      },
    ],
  });

  expect(result).toEqual({
    ok: false,
    error: { kind: "no_due_candidates" },
  });
});
