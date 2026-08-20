import assert from "node:assert/strict";

import {
  getChampionshipPointsForCompetition,
  getChampionshipPointsFromThresholds,
} from "../engines/judging.engine";

const thresholds = {
  onePointThreshold: 3,
  twoPointThreshold: 5,
  threePointThreshold: 8,
  fourPointThreshold: 11,
  fivePointThreshold: 15,
};

const expected = [
  [2, 0], [3, 1], [4, 1], [5, 2], [7, 2], [8, 3], [10, 3],
  [11, 4], [14, 4], [15, 5], [50, 5],
] as const;
for (const [dogsInCompetition, points] of expected) {
  assert.equal(getChampionshipPointsFromThresholds({ dogsInCompetition, thresholds }), points, `dynamic thresholds at ${dogsInCompetition}`);
}
assert.equal(getChampionshipPointsForCompetition(2), 1, "legacy two-dog threshold remains unchanged");
assert.equal(getChampionshipPointsForCompetition(6), 5, "legacy five-point threshold remains unchanged");
console.log("Annual Championship Point Schedule threshold lookup checks passed.");
