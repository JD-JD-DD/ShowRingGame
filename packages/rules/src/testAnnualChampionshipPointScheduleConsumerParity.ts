import assert from "node:assert/strict";

import { calculateGrandChampionPointsFromCompetition } from "../engines/grandChampionPointApplication.engine";
import type { GrandChampionAwardCompetitionResult } from "../engines/grandChampionCompetition.engine";
import { getChampionshipPointsFromThresholds, type ChampionshipPointThresholds } from "../engines/judging.engine";

const maleThresholds: ChampionshipPointThresholds = {
  onePointThreshold: 4,
  twoPointThreshold: 7,
  threePointThreshold: 10,
  fourPointThreshold: 14,
  fivePointThreshold: 19,
};
const femaleThresholds: ChampionshipPointThresholds = {
  onePointThreshold: 2,
  twoPointThreshold: 5,
  threePointThreshold: 9,
  fourPointThreshold: 12,
  fivePointThreshold: 16,
};

function gchResult(sex: "M" | "F", competitionCount: number): GrandChampionAwardCompetitionResult {
  return {
    awardCode: "BOS",
    recipientDogId: `gch-${sex}`,
    recipientSex: sex,
    recipientEligible: true,
    competitionCount,
    championDefeatFacts: {
      qualifyingChampionOpponentCount: 1,
      countsAsPotentialChampionDefeat: true,
    },
  };
}

for (const [sex, thresholds, competitionCount, expected] of [
  ["M", maleThresholds, 14, 4],
  ["F", femaleThresholds, 12, 4],
] as const) {
  const championshipPoints = getChampionshipPointsFromThresholds({ dogsInCompetition: competitionCount, thresholds });
  const grandChampionPoints = calculateGrandChampionPointsFromCompetition({
    competitionResult: gchResult(sex, competitionCount),
    thresholds,
  }).pointsAwarded;

  assert.equal(championshipPoints, expected, `${sex} CH uses its published threshold row`);
  assert.equal(grandChampionPoints, expected, `${sex} GCH uses that same published threshold row`);
  assert.equal(grandChampionPoints, championshipPoints, `${sex} CH and GCH threshold conversion agrees`);
}

assert.notEqual(
  getChampionshipPointsFromThresholds({ dogsInCompetition: 12, thresholds: maleThresholds }),
  getChampionshipPointsFromThresholds({ dogsInCompetition: 12, thresholds: femaleThresholds }),
  "male and female schedules remain independently selected"
);

console.log("Annual Championship Point Schedule CH/GCH consumer parity checks passed.");
