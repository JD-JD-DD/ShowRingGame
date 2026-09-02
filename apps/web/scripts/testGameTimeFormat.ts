import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { SHOW_YEAR_HOURS } from "@showring/rules";

import {
  formatDogAge,
  formatGameAge,
  formatGameCountdownHours,
  formatRealDuration,
  formatRealCountdownMs,
  formatShortCountdownHours,
  formatUtcDateTime,
} from "../lib/gameTimeFormat";

const studiesPageSource = readFileSync(
  join(process.cwd(), "app/studs/page.tsx"),
  "utf8"
);
const programPlannerSource = readFileSync(
  join(process.cwd(), "server/services/programPlanner.service.ts"),
  "utf8"
);

const formatStudAge = (ageHours: number) => {
  const years = Math.floor(ageHours / SHOW_YEAR_HOURS);
  const days = ageHours % SHOW_YEAR_HOURS;
  return years <= 0 ? `${days} days` : `${years}y ${days}d`;
};
const formatPlannerAge = (ageHours: number) => {
  const years = Math.floor(ageHours / SHOW_YEAR_HOURS);
  const weeks = Math.floor((ageHours % SHOW_YEAR_HOURS) / 7);
  return years > 0
    ? `${years} yr${years === 1 ? "" : "s"} ${weeks} wk${
        weeks === 1 ? "" : "s"
      }`
    : `${weeks} wk${weeks === 1 ? "" : "s"}`;
};

assert.match(studiesPageSource, /import\s*\{\s*SHOW_YEAR_HOURS\s*\}\s*from\s*["']@showring\/rules["']/);
assert.match(studiesPageSource, /Math\.floor\(ageHours \/ SHOW_YEAR_HOURS\)/);
assert.match(studiesPageSource, /ageHours % SHOW_YEAR_HOURS/);
assert.match(programPlannerSource, /SHOW_YEAR_HOURS,\s*\}\s*from\s*["']@showring\/rules["']/);
assert.match(programPlannerSource, /Math\.floor\(ageHours \/ SHOW_YEAR_HOURS\)/);
assert.match(programPlannerSource, /ageHours % SHOW_YEAR_HOURS/);
assert.doesNotMatch(studiesPageSource, /(?:\/|%)\s*365/);
assert.doesNotMatch(programPlannerSource, /(?:\/|%)\s*365/);
assert.deepEqual(
  [SHOW_YEAR_HOURS - 1, SHOW_YEAR_HOURS, SHOW_YEAR_HOURS + 2].map(formatStudAge),
  ["364 days", "1y 0d", "1y 2d"],
  "stud age labels retain years and days at the canonical game-year boundary"
);
assert.deepEqual(
  [SHOW_YEAR_HOURS - 1, SHOW_YEAR_HOURS, SHOW_YEAR_HOURS + 14].map(formatPlannerAge),
  ["52 wks", "1 yr 0 wks", "1 yr 2 wks"],
  "planner age labels retain years and weeks at the canonical game-year boundary"
);

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
