import { strict as assert } from "node:assert";

import {
  formatDogAge,
  formatGameAge,
  formatGameCountdownHours,
  formatRealDuration,
  formatRealCountdownMs,
  formatShortCountdownHours,
  formatUtcDateTime,
} from "../lib/gameTimeFormat";

const boundaryHours = [-1, 0, 1, 6, 7, 23, 24, 25, 168, 365, 730];

assert.deepEqual(
  boundaryHours.map(formatDogAge),
  ["0d", "0d", "1d", "6d", "1w", "3w", "3w", "3w", "24w", "1y", "2y"],
  "dog age labels use compact game-age days, weeks, and years"
);

assert.deepEqual(
  [0, 1, 7, 8, 365, 372].map(formatGameAge),
  ["0 days", "1 day", "1 week", "1 week 1 day", "1 year", "1 year 1 week"],
  "game ages remain separate from actionable real waits"
);

assert.deepEqual(
  boundaryHours.map(formatGameCountdownHours),
  [
    "Now",
    "Now",
    "1h",
    "6h",
    "7h",
    "23h",
    "1d",
    "1d 1h",
    "1w",
    "2w 1d",
    "4w 2d",
  ],
  "game countdown labels use compact real elapsed hours, days, weeks, and years"
);

assert.deepEqual(
  boundaryHours.map(formatShortCountdownHours),
  [
    "Now",
    "Now",
    "1h",
    "6h",
    "7h",
    "23h",
    "1d",
    "1d 1h",
    "7d",
    "15d 5h",
    "30d 10h",
  ],
  "short countdown labels stay compact for rows and cards"
);

assert.deepEqual(
  [
    -1,
    0,
    1,
    12 * 60 * 1000,
    60 * 60 * 1000,
    4 * 60 * 60 * 1000 + 12 * 60 * 1000,
    2 * 24 * 60 * 60 * 1000 +
      4 * 60 * 60 * 1000 +
      12 * 60 * 1000,
  ].map(formatRealCountdownMs),
  ["Now", "Now", "1 minute", "12 minutes", "1 hour", "4 hours 12 minutes", "2 days 4 hours"],
  "real countdown labels preserve minute precision"
);

assert.equal(formatRealDuration(-1), "Now", "expired waits clamp cleanly");
assert.match(formatUtcDateTime(0), /UTC$/, "UTC timestamps are explicitly labelled");

console.log("Game time format checks passed.");
