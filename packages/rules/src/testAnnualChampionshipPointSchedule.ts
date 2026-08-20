import assert from "node:assert/strict";

import {
  AnnualChampionshipPointScheduleCalculationError,
  calculateAnnualChampionshipPointSchedule,
} from "../engines/annualChampionshipPointSchedule.engine";

const repeat = (count: number, value: number) => Array.from({ length: count }, () => value);
const exactTargetSample = [...repeat(80, 2), ...repeat(2, 4), ...repeat(16, 5), ...repeat(2, 8)];

function assertStrictlyMonotonic(counts: readonly number[]) {
  const result = calculateAnnualChampionshipPointSchedule({ competitionCounts: counts });
  assert.ok(result.onePointThreshold < result.twoPointThreshold && result.twoPointThreshold < result.threePointThreshold && result.threePointThreshold < result.fourPointThreshold && result.fourPointThreshold < result.fivePointThreshold, "successful schedules are strictly monotonic");
  return result;
}

function assertFailure(counts: readonly number[], code: AnnualChampionshipPointScheduleCalculationError["code"]) {
  assert.throws(
    () => calculateAnnualChampionshipPointSchedule({ competitionCounts: counts }),
    (error: unknown) => error instanceof AnnualChampionshipPointScheduleCalculationError && error.code === code
  );
}

function main() {
  const original = [...exactTargetSample];
  const exact = assertStrictlyMonotonic(exactTargetSample);
  assert.equal(exact.onePointThreshold, 2, "one-point 95% highest qualifying threshold");
  assert.equal(exact.threePointThreshold, 5, "major exact 18% threshold");
  assert.equal(exact.fivePointThreshold, 8, "five-point exact 2% threshold");
  assert.equal(exact.twoPointThreshold, 4, "two-point .5 midpoint uses Math.round");
  assert.equal(exact.fourPointThreshold, 7, "four-point interpolation uses two-thirds rounding");
  assert.equal(exact.achievedMajorRate, 0.18, "major audit rate retains ratio precision");
  assert.deepEqual(exactTargetSample, original, "calculator does not mutate caller input");
  assert.deepEqual(calculateAnnualChampionshipPointSchedule({ competitionCounts: [...exactTargetSample].reverse() }), exact, "input order does not affect output");

  const onePointBoundary = assertStrictlyMonotonic([...repeat(5, 2), ...repeat(75, 3), ...repeat(2, 5), ...repeat(16, 6), ...repeat(2, 10)]);
  assert.equal(onePointBoundary.onePointThreshold, 3, "highest one-point threshold meeting the 95% target is selected");

  const integerMidpoint = assertStrictlyMonotonic([...repeat(80, 2), ...repeat(2, 4), ...repeat(16, 8), ...repeat(2, 12)]);
  assert.equal(integerMidpoint.twoPointThreshold, 5, "two-point integer midpoint is preserved");

  const oneDogFloor = assertStrictlyMonotonic([...repeat(10, 1), ...repeat(80, 2), ...repeat(2, 4), ...repeat(6, 5), ...repeat(2, 8)]);
  assert.equal(oneDogFloor.onePointThreshold, 2, "one-point threshold never drops below two dogs");
  assert.equal(oneDogFloor.achievedOnePointRate, 0.9, "one-dog floor reports the true achieved rate");

  const majorCeiling = assertStrictlyMonotonic([...repeat(75, 2), ...repeat(21, 8), ...repeat(4, 12), 16]);
  assert.equal(majorCeiling.threePointThreshold, 12, "major candidate above the 20% ceiling is rejected even when closer");
  assert.ok(majorCeiling.achievedMajorRate <= 0.2, "major rate respects the hard ceiling");

  const majorTie = assertStrictlyMonotonic([...repeat(80, 2), ...repeat(4, 4), ...repeat(14, 8), ...repeat(2, 12)]);
  assert.equal(majorTie.threePointThreshold, 8, "16%/20% and same-rate ties select the higher threshold");
  assert.equal(majorTie.achievedMajorRate, 0.16, "major tie selects the conservative rate");

  const reachableFive = assertStrictlyMonotonic([...repeat(8, 2), 4, 6]);
  assert.equal(reachableFive.threePointThreshold, 4, "major threshold remains reachable");
  assert.equal(reachableFive.fivePointThreshold, 6, "five-point selection never invents max observed plus one");
  assert.equal(reachableFive.achievedFivePointRate, 0.1, "nearest reachable five-point rate is retained");

  assertStrictlyMonotonic([...repeat(900, 2), ...repeat(50, 4), ...repeat(40, 8), ...repeat(10, 16)]);

  assertFailure([2, 2, 3, 3], "NO_VALID_MAJOR_THRESHOLD");
  assertFailure([...repeat(80, 2), ...repeat(4, 4), ...repeat(16, 8)], "NO_VALID_FIVE_POINT_THRESHOLD");
  assertFailure([2, 4, 4, 4], "NO_VALID_MAJOR_THRESHOLD");
  const invalidSamples: unknown[] = [[], [0], [-1], [1.5], [Number.NaN], [Number.POSITIVE_INFINITY], ["2"]];
  for (const invalid of invalidSamples) assertFailure(invalid as number[], "INVALID_COMPETITION_COUNTS");
  console.log("Annual Championship Point Schedule calculator checks passed.");
}

main();
