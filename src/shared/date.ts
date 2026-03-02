import type { LocalDateKey } from "./types.ts";

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export const REVIEW_INTERVAL_DAYS = 14;

export interface LocalDateProvider {
  today(): LocalDateKey;
}

export interface LocalDateMath {
  isSameDay(left: LocalDateKey | null, right: LocalDateKey): boolean;
  elapsedDays(from: LocalDateKey, to: LocalDateKey): number;
  isDue(registeredOn: LocalDateKey, today: LocalDateKey): boolean;
}

function formatLocalDate(date: Date): LocalDateKey {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseLocalDateKey(value: LocalDateKey): Date {
  const [year, month, day] = value.split("-").map((part) => Number(part));

  return new Date(Date.UTC(year, month - 1, day));
}

export function createLocalDateProvider(
  now: () => Date = () => new Date(),
): LocalDateProvider {
  return {
    today() {
      return formatLocalDate(now());
    },
  };
}

export function createLocalDateMath(): LocalDateMath {
  return {
    isSameDay(left, right) {
      return left !== null && left === right;
    },
    elapsedDays(from, to) {
      const start = parseLocalDateKey(from);
      const end = parseLocalDateKey(to);

      return Math.round((end.getTime() - start.getTime()) / MILLISECONDS_PER_DAY);
    },
    isDue(registeredOn, today) {
      return this.elapsedDays(registeredOn, today) >= REVIEW_INTERVAL_DAYS;
    },
  };
}
