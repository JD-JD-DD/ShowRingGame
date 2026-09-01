import assert from "node:assert/strict";

import {
  resolveAnnualChampionshipPointScheduleSource,
  type AnnualChampionshipCompetitionObservationForResolution,
  type PriorPublishedAnnualChampionshipPointSchedule,
} from "../engines/annualChampionshipPointScheduleFallback.engine";

const validCounts = [2, 2, 2, 2, 2, 2, 2, 2, 4, 6];
const observations = (counts: readonly number[], overrides: Partial<AnnualChampionshipCompetitionObservationForResolution> = {}) =>
  counts.map((dogsInCompetition) => ({ sourceYear: 16, district: 4, breedCode2: "GR", sex: "M" as const, dogsInCompetition, ...overrides }));
const prior = (overrides: Partial<PriorPublishedAnnualChampionshipPointSchedule> = {}): PriorPublishedAnnualChampionshipPointSchedule => ({
  id: "prior-16-gr-m-d4", effectiveYear: 16, district: 4, breedCode2: "GR", sex: "M", publicationStatus: "PUBLISHED",
  onePointThreshold: 2, twoPointThreshold: 3, threePointThreshold: 4, fourPointThreshold: 5, fivePointThreshold: 6,
  observationCount: 44, achievedOnePointRate: 0.95, achievedMajorRate: 0.18, achievedFivePointRate: 0.02, ...overrides,
});
const resolve = (input: Partial<Parameters<typeof resolveAnnualChampionshipPointScheduleSource>[0]> = {}) =>
  resolveAnnualChampionshipPointScheduleSource({ sourceYear: 16, targetDistrict: 4, targetBreedCode2: "GR", targetSex: "M", observations: [], ...input });

function main() {
  const local = resolve({ observations: observations(validCounts), priorPublishedSchedule: prior() });
  assert.equal(local.resolutionType, "LOCAL", "valid local sample wins before fallback");

  const inherited = resolve({ observations: observations(validCounts.slice(0, 6)), priorPublishedSchedule: prior() });
  assert.equal(inherited.resolutionType, "PRIOR_PUBLISHED_SCHEDULE", "small local sample inherits an exact published prior schedule");
  if (inherited.resolutionType === "PRIOR_PUBLISHED_SCHEDULE") assert.equal(inherited.priorSchedule.id, "prior-16-gr-m-d4", "prior thresholds are inherited directly");

  const structurallyInvalidLocal = resolve({ observations: observations([2, 2, 2, 2, 2, 2, 3, 3, 3, 3]), priorPublishedSchedule: prior() });
  assert.equal(structurallyInvalidLocal.resolutionType, "PRIOR_PUBLISHED_SCHEDULE", "structurally invalid local population advances to prior fallback");

  for (const invalidPrior of [prior({ publicationStatus: "DRAFT" }), prior({ effectiveYear: 15 }), prior({ district: 5 }), prior({ breedCode2: "LR" }), prior({ sex: "F" })]) {
    const result = resolve({ observations: [...observations(validCounts.slice(0, 6)), ...observations(validCounts.slice(6), { district: 5 })], priorPublishedSchedule: invalidPrior });
    assert.equal(result.resolutionType, "NATIONAL_SAME_BREED_SAME_SEX", "only exact published prior schedules are eligible");
  }

  const national = resolve({
    observations: [
      ...observations(validCounts.slice(0, 6)),
      ...observations(validCounts.slice(6), { district: 5 }),
      ...observations(validCounts, { sex: "F" }),
      ...observations(validCounts, { breedCode2: "LR" }),
    ],
  });
  assert.equal(national.resolutionType, "NATIONAL_SAME_BREED_SAME_SEX", "national fallback includes only same breed and sex across districts");
  if (national.resolutionType === "NATIONAL_SAME_BREED_SAME_SEX") {
    assert.equal(national.sourceObservationCount, 10, "local observations are not padded or blended with unrelated populations");
    assert.equal(national.targetDistrict, 4, "national source does not change the canonical target district");
  }

  const bootstrap = resolve({ observations: [...observations(validCounts.slice(0, 6)), ...observations(validCounts.slice(6), { district: 5 })] });
  assert.equal(bootstrap.resolutionType, "NATIONAL_SAME_BREED_SAME_SEX", "first-year bootstrap works without a fake prior schedule");

  const minimumSmall = resolve({ observations: observations(validCounts.slice(0, 9)) });
  assert.equal(minimumSmall.resolutionType, "MINIMUM_POINT_SCHEDULE", "insufficient national sample uses the canonical minimum schedule");
  if (minimumSmall.resolutionType === "MINIMUM_POINT_SCHEDULE") {
    assert.deepEqual(
      minimumSmall.calculation,
      { onePointThreshold: 2, twoPointThreshold: 3, threePointThreshold: 4, fourPointThreshold: 5, fivePointThreshold: 6, observationCount: 9, achievedOnePointRate: 1, achievedMajorRate: 1 / 9, achievedFivePointRate: 0 },
      "minimum schedule retains its canonical thresholds and source-population audit rates"
    );
  }
  const minimumShape = resolve({ observations: observations([2, 2, 2, 2, 2, 2, 3, 3, 3, 3]) });
  assert.equal(minimumShape.resolutionType, "MINIMUM_POINT_SCHEDULE", "structurally invalid national sample uses the canonical minimum schedule");
  const malformed = resolve({ observations: observations([0, 2, 2, 2, 2, 2, 2, 2, 4, 6]) });
  assert.equal(malformed.resolutionType, "DATA_QUALITY_ERROR", "malformed persisted counts are not hidden behind fallback");
  const noMaleData = resolve({ observations: observations(validCounts, { sex: "F" }) });
  assert.equal(noMaleData.resolutionType, "MINIMUM_POINT_SCHEDULE", "opposite-sex observations are never borrowed before using the minimum schedule");
  const noBreedData = resolve({ observations: observations(validCounts, { breedCode2: "LR" }) });
  assert.equal(noBreedData.resolutionType, "MINIMUM_POINT_SCHEDULE", "unrelated breeds are never borrowed before using the minimum schedule");
  assert.deepEqual(resolve({ observations: [...observations(validCounts)].reverse() }), local, "observation order does not change resolution");
  console.log("Annual Championship Point Schedule fallback checks passed.");
}

main();
