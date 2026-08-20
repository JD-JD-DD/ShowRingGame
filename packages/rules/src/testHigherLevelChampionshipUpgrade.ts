import assert from "node:assert/strict";

import { calculateHigherLevelChampionshipUpgrade } from "../engines/judging.engine";

const ratings = [
  { breedCode2: "A", groupCode: "SPORTING", pointsAwarded: 2 },
  { breedCode2: "A", groupCode: "SPORTING", pointsAwarded: 4 },
  { breedCode2: "B", groupCode: "SPORTING", pointsAwarded: 3 },
  { breedCode2: "C", groupCode: "SPORTING", pointsAwarded: 5 },
  { breedCode2: "D", groupCode: "SPORTING", pointsAwarded: 0 },
  { breedCode2: "E", groupCode: "HOUND", pointsAwarded: 4 },
  { breedCode2: "F", groupCode: "TOY", pointsAwarded: 3 },
] as const;
const calculate = (overrides: Partial<Parameters<typeof calculateHigherLevelChampionshipUpgrade>[0]> = {}) =>
  calculateHigherLevelChampionshipUpgrade({
    recipientWasWinners: true,
    existingPoints: 2,
    eligibleBreedRatings: ratings,
    ...overrides,
  });

assert.deepEqual(calculate(), { comparisonPoints: 5, pointsAwarded: 5 }, "Group 1/BIS uses the highest positive persisted WD/WB rating");
assert.deepEqual(calculate({ excludedBreedCodes: new Set(["C"]) }), { comparisonPoints: 4, pointsAwarded: 4 }, "Group 2 excludes both WD and WB ratings from the higher-placed breed");
assert.deepEqual(calculate({ excludedBreedCodes: new Set(["A", "B", "C"]) }), { comparisonPoints: 4, pointsAwarded: 4 }, "Group 4 retains eligible unplaced-breed ratings after only higher breeds are excluded");
assert.deepEqual(calculate({ excludedGroupCodes: new Set(["SPORTING"]) }), { comparisonPoints: 4, pointsAwarded: 4 }, "RBIS excludes the entire BIS winner's Group");
assert.deepEqual(calculate({ recipientWasWinners: false, existingPoints: 5 }), { comparisonPoints: 5, pointsAwarded: 0 }, "Champion specials receive no ordinary Group/BIS CH points");
assert.deepEqual(calculate({ existingPoints: 5, excludedBreedCodes: new Set(["C"]) }), { comparisonPoints: 4, pointsAwarded: 5 }, "higher-level ratings are inclusive and never reduce breed-level points");
assert.deepEqual(calculate({ eligibleBreedRatings: [{ breedCode2: "D", groupCode: "SPORTING", pointsAwarded: 0 }] }), { comparisonPoints: 0, pointsAwarded: 2 }, "zero-point Winners do not manufacture a point");
assert.deepEqual(calculate({ eligibleBreedRatings: ratings.filter((rating) => rating.breedCode2 === "A") }), { comparisonPoints: 4, pointsAwarded: 4 }, "WD and WB ratings within a breed collapse by maximum rather than addition");
assert.deepEqual(calculate({ eligibleBreedRatings: [...ratings].reverse() }), calculate(), "comparison outcome is independent of persisted award ordering");

console.log("Higher-level Championship upgrade checks passed.");
