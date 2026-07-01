import {
  getGeneratedShowWeekendKey,
  getGeneratedShowWeekendPrefix,
  getShowWeekendKey,
  getShowWeekendStartEpoch,
} from "./showWeekend";

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

assertEqual(
  getGeneratedShowWeekendKey("generated-year-10-week-40-slot-1"),
  "year-10-week-40",
  "generated slot 1 weekend key"
);
assertEqual(
  getGeneratedShowWeekendKey("generated-year-10-week-40-slot-3"),
  "year-10-week-40",
  "generated slot 3 weekend key"
);
assertEqual(
  getGeneratedShowWeekendPrefix("generated-year-10-week-40-slot-2"),
  "generated-year-10-week-40-slot-",
  "generated weekend prefix"
);
assertEqual(
  getGeneratedShowWeekendKey("generated-year-13-fixed-week-1-slot-2"),
  "year-13-week-1",
  "corrected generated weekend key"
);
assertEqual(
  getGeneratedShowWeekendPrefix("generated-year-13-fixed-week-1-slot-2"),
  "generated-year-13-fixed-week-1-slot-",
  "corrected generated weekend prefix"
);
assertEqual(
  getShowWeekendKey({
    clusterId: "generated-year-10-week-40-slot-2",
    startEpoch: 0,
  }),
  "year-10-week-40",
  "generated weekend key wins over epoch fallback"
);
assertEqual(getShowWeekendStartEpoch(0), 0, "epoch 0 starts week 1");
assertEqual(getShowWeekendStartEpoch(6), 0, "epoch 6 stays week 1");
assertEqual(getShowWeekendStartEpoch(7), 7, "epoch 7 starts week 2");
assertEqual(
  getShowWeekendKey({ startEpoch: 365 * 9 + 7 * 39 + 5 }),
  "year-10-week-40",
  "fallback epoch weekend key"
);

console.log("Show weekend key checks passed.");
