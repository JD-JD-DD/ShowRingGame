import { strict as assert } from "node:assert";

import {
  formatDogAge,
  formatGameCountdownHours,
  formatRealCountdownMs,
  formatShortCountdownHours,
} from "../lib/gameTimeFormat";

const boundaryHours = [-1, 0, 1, 6, 7, 23, 24, 25, 168, 365, 730];

assert.deepEqual(
  boundaryHours.map(formatDogAge),
  ["0d", "0d", "1d", "6d", "1w", "3w", "3w", "3w", "24w", "1y", "2y"],
  "dog age labels use compact game-age days, weeks, and years"
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
  ["Now", "Now", "1m", "12m", "1h 0m", "4h 12m", "2d 4h 12m"],
  "real countdown labels preserve minute precision"
);

console.log("Game time format checks passed.");
