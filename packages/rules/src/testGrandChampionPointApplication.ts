import assert from "node:assert/strict";

import {
  calculateGrandChampionPointsFromCompetition,
  calculateLegacyGrandChampionPointsFromCompetition,
} from "../engines/grandChampionPointApplication.engine";
import type { GrandChampionAwardCompetitionResult } from "../engines/grandChampionCompetition.engine";

const maleThresholds = { onePointThreshold: 3, twoPointThreshold: 5, threePointThreshold: 7, fourPointThreshold: 9, fivePointThreshold: 11 };
const femaleThresholds = { onePointThreshold: 2, twoPointThreshold: 4, threePointThreshold: 6, fourPointThreshold: 8, fivePointThreshold: 10 };

function result(overrides: Partial<GrandChampionAwardCompetitionResult> = {}): GrandChampionAwardCompetitionResult {
  return {
    awardCode: "BOB",
    recipientDogId: "bob",
    recipientSex: "M",
    recipientEligible: true,
    competitionCount: 8,
    bobSameSexComparisonCount: 5,
    championDefeatFacts: { qualifyingChampionOpponentCount: 1, countsAsPotentialChampionDefeat: true },
    ...overrides,
  };
}

{
  const value = calculateGrandChampionPointsFromCompetition({ competitionResult: result(), thresholds: maleThresholds });
  assert.deepEqual({ full: value.bobFullPoints, sameSex: value.bobSameSexComparisonPoints, final: value.pointsAwarded }, { full: 3, sameSex: 2, final: 3 }, "male BOB chooses the greater full-count value");
}
{
  const value = calculateGrandChampionPointsFromCompetition({ competitionResult: result({ recipientSex: "F", competitionCount: 5, bobSameSexComparisonCount: 8 }), thresholds: femaleThresholds });
  assert.deepEqual({ full: value.bobFullPoints, sameSex: value.bobSameSexComparisonPoints, final: value.pointsAwarded }, { full: 2, sameSex: 4, final: 4 }, "BOB comparison is applied independently and can select same-sex value");
}
assert.equal(calculateGrandChampionPointsFromCompetition({ competitionResult: result({ competitionCount: 7, bobSameSexComparisonCount: 7 }), thresholds: maleThresholds }).pointsAwarded, 3, "equal BOB values are not added");
assert.equal(calculateGrandChampionPointsFromCompetition({ competitionResult: result({ awardCode: "BOS", recipientSex: "M", competitionCount: 9 }), thresholds: maleThresholds }).pointsAwarded, 4, "BOS uses recipient male schedule directly");
assert.equal(calculateGrandChampionPointsFromCompetition({ competitionResult: result({ awardCode: "BOS", recipientSex: "F", competitionCount: 9 }), thresholds: femaleThresholds }).pointsAwarded, 4, "BOS uses recipient female schedule directly");
assert.equal(calculateGrandChampionPointsFromCompetition({ competitionResult: result({ awardCode: "SELECT_DOG", recipientSex: "M", competitionCount: 11 }), thresholds: maleThresholds }).pointsAwarded, 5, "Select Dog uses male schedule without another subtraction");
assert.equal(calculateGrandChampionPointsFromCompetition({ competitionResult: result({ awardCode: "SELECT_BITCH", recipientSex: "F", competitionCount: 10 }), thresholds: femaleThresholds }).pointsAwarded, 5, "Select Bitch uses female schedule without another subtraction");
assert.equal(calculateGrandChampionPointsFromCompetition({ competitionResult: result({ recipientEligible: false, competitionCount: 100 }), thresholds: maleThresholds }).pointsAwarded, 0, "ineligible same-day Winner receives no GCH points");
assert.equal(calculateGrandChampionPointsFromCompetition({ competitionResult: result({ awardCode: "BOS", competitionCount: 2 }), thresholds: maleThresholds }).pointsAwarded, 0, "below one-point threshold is zero");
assert.equal(calculateGrandChampionPointsFromCompetition({ competitionResult: result({ competitionCount: 100 }), thresholds: maleThresholds }).pointsAwarded, 5, "published threshold helper caps at five points");
assert.equal(calculateLegacyGrandChampionPointsFromCompetition(result({ awardCode: "BOS", competitionCount: 6 })).pointsAwarded, 5, "Year 16 legacy conversion remains isolated");
{
  const input = result();
  const before = structuredClone(input);
  assert.deepEqual(calculateGrandChampionPointsFromCompetition({ competitionResult: input, thresholds: maleThresholds }), calculateGrandChampionPointsFromCompetition({ competitionResult: input, thresholds: maleThresholds }), "point application is deterministic");
  assert.deepEqual(input, before, "point application does not mutate GCH-03 result");
}
console.log("Grand Champion point application checks passed.");
