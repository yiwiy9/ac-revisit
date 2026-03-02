import assert from "node:assert/strict";
import { test } from "vitest";

import {
  REVIEW_INTERVAL_DAYS,
  createLocalDateMath,
  createLocalDateProvider,
} from "../src/shared/date.ts";

test("LocalDateProvider normalizes browser-local dates into canonical keys", () => {
  const provider = createLocalDateProvider(
    () => new Date("2026-01-02T12:00:00Z"),
  );

  assert.equal(provider.today(), "2026-01-02");
});

test("LocalDateMath centralizes same-day comparison, including null inputs", () => {
  const dateMath = createLocalDateMath();

  assert.equal(dateMath.isSameDay("2026-03-02", "2026-03-02"), true);
  assert.equal(dateMath.isSameDay("2026-03-01", "2026-03-02"), false);
  assert.equal(dateMath.isSameDay(null, "2026-03-02"), false);
});

test("LocalDateMath returns whole-day deltas across month and leap-year boundaries", () => {
  const dateMath = createLocalDateMath();

  assert.equal(dateMath.elapsedDays("2026-02-16", "2026-03-02"), 14);
  assert.equal(dateMath.elapsedDays("2024-02-28", "2024-03-01"), 2);
  assert.equal(dateMath.elapsedDays("2025-12-31", "2026-01-01"), 1);
});

test("LocalDateMath centralizes the fixed 14-day due rule", () => {
  const dateMath = createLocalDateMath();

  assert.equal(dateMath.isDue("2026-02-16", "2026-03-02"), true);
  assert.equal(dateMath.isDue("2026-02-17", "2026-03-02"), false);
});

test("The review interval stays fixed at 14 days for MVP", () => {
  assert.equal(REVIEW_INTERVAL_DAYS, 14);
});
