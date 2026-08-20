import assert from "node:assert/strict";

import {
  calculateBreedLevelChampionshipUpgrade,
  judgeBreedBlock,
} from "../engines/judging.engine";
import { DEFAULT_CATEGORY_WEIGHTS } from "../constants/judging.constants";
import type { Dog } from "../engines/dog.engine";
import type { Judge } from "../engines/judge.engine";

const maleThresholds = {
  onePointThreshold: 3,
  twoPointThreshold: 5,
  threePointThreshold: 7,
  fourPointThreshold: 9,
  fivePointThreshold: 11,
};
const femaleThresholds = {
  onePointThreshold: 2,
  twoPointThreshold: 4,
  threePointThreshold: 6,
  fourPointThreshold: 8,
  fivePointThreshold: 10,
};
const calculate = (overrides: Partial<Parameters<typeof calculateBreedLevelChampionshipUpgrade>[0]> = {}) =>
  calculateBreedLevelChampionshipUpgrade({
    recipientSex: "M",
    basePoints: 2,
    oppositeSexBasePoints: 3,
    wonBow: false,
    wonBos: false,
    wonBob: false,
    regularSameSexCount: 5,
    additionalBobMaleCount: 3,
    additionalBobFemaleCount: 2,
    thresholds: maleThresholds,
    ...overrides,
  });

assert.deepEqual(calculate({ wonBow: true }), {
  bowPoints: 3,
  bosPoints: null,
  bosCompetitionCount: null,
  bobPoints: null,
  bobCompetitionCount: null,
  finalPoints: 3,
}, "BOW is the higher WD/WB value, never a sum");
assert.equal(calculate({ basePoints: 0, oppositeSexBasePoints: 0, wonBow: true }).finalPoints, 0, "zero WD/WB values do not create a combined-sex BOW point");
assert.deepEqual(calculate({ wonBos: true }), {
  bowPoints: null,
  bosPoints: 3,
  bosCompetitionCount: 8,
  bobPoints: null,
  bobCompetitionCount: null,
  finalPoints: 3,
}, "male BOS uses regular male plus additional male BOB population only");
assert.deepEqual(calculate({ wonBob: true }), {
  bowPoints: null,
  bosPoints: null,
  bosCompetitionCount: null,
  bobPoints: 4,
  bobCompetitionCount: 10,
  finalPoints: 4,
}, "male BOB uses same-sex regular plus both-sex additional BOB population without double-counting Winners");
assert.equal(calculate({ basePoints: 5, wonBob: true }).finalPoints, 5, "an upgrade cannot reduce the class dog's already-earned value");
assert.equal(calculate({ wonBow: true, wonBob: true }).finalPoints, 4, "inclusive award values use max rather than addition");
assert.deepEqual(calculate({
  recipientSex: "F",
  basePoints: 2,
  oppositeSexBasePoints: 1,
  regularSameSexCount: 4,
  additionalBobMaleCount: 3,
  additionalBobFemaleCount: 2,
  thresholds: femaleThresholds,
  wonBos: true,
}), {
  bowPoints: null,
  bosPoints: 3,
  bosCompetitionCount: 6,
  bobPoints: null,
  bobCompetitionCount: null,
  finalPoints: 3,
}, "female BOS uses its own schedule and same-sex population");
assert.equal(calculate({ wonBob: true }).finalPoints <= 5, true, "one ShowDay Championship value remains capped at five points");

const judge: Judge = {
  judgeId: "judge-points-07a",
  name: "Points 07A Judge",
  style: "BALANCED",
  categoryWeights: { ...DEFAULT_CATEGORY_WEIGHTS },
};
function dog(id: string, sex: "M" | "F", traitValue: number): Dog {
  return {
    dogId: id, regNumber: id, breedCode2: "TST", birthEpoch: 0, sex,
    status: "ALIVE", litterId: null, litterOrder: null, sireId: null, damId: null,
    traits: { head: traitValue, forequarters: traitValue, hindquarters: traitValue, gait: traitValue, coat: traitValue, size: traitValue, temperament: traitValue, show_shine: traitValue, feet: traitValue, topline: traitValue },
  };
}
const entries = [
  { dog: dog("wd-bob", "M", 10) },
  { dog: dog("male-2", "M", 8) }, { dog: dog("male-3", "M", 7.9) }, { dog: dog("male-4", "M", 7.8) }, { dog: dog("male-5", "M", 7.7) },
  { dog: dog("wb-bos", "F", 9.8) }, { dog: dog("female-2", "F", 7.6) },
  { dog: dog("special-m-1", "M", 7.5), isChampion: true }, { dog: dog("special-m-2", "M", 7.4), isChampion: true }, { dog: dog("special-m-3", "M", 7.3), isChampion: true },
  { dog: dog("special-f-1", "F", 7.2), isChampion: true }, { dog: dog("special-f-2", "F", 7.1), isChampion: true },
];
const judged = judgeBreedBlock({
  judge,
  random01: () => 0.5,
  entries: entries.map((entry, index) => ({ ...entry, showEntryId: `entry-${index}` })),
  championshipPointThresholds: { M: maleThresholds, F: femaleThresholds },
});
const bob = judged.awards.find((award) => award.awardCode === "BOB");
const bos = judged.awards.find((award) => award.awardCode === "BOS");
assert.deepEqual(
  { dogId: bob?.dogId, points: bob?.pointsAwarded, count: bob?.dogsInCompetition, major: bob?.isMajor },
  { dogId: "wd-bob", points: 4, count: 10, major: true },
  "Year 17 BOB upgrade persists its exact same-sex-regular plus both-sex-special count"
);
assert.deepEqual(
  { dogId: bos?.dogId, points: bos?.pointsAwarded, count: bos?.dogsInCompetition },
  { dogId: "wb-bos", points: 2, count: 4 },
  "Year 17 BOS upgrade uses its own female schedule and excludes opposite-sex BOB entries"
);

const championBob = judgeBreedBlock({
  judge,
  random01: () => 0.5,
  entries: [
    { showEntryId: "champion", dog: dog("champion-bob", "M", 10), isChampion: true },
    { showEntryId: "wd", dog: dog("wd", "M", 9) },
    { showEntryId: "wb", dog: dog("wb", "F", 8) },
  ],
  championshipPointThresholds: { M: maleThresholds, F: femaleThresholds },
});
assert.equal(championBob.awards.find((award) => award.awardCode === "BOB")?.pointsAwarded, 0, "Champion-special BOB earns no ordinary CH points");
assert.equal(judgeBreedBlock({ judge, random01: () => 0.5, entries: entries.map((entry, index) => ({ ...entry, showEntryId: `legacy-${index}` })) }).awards.find((award) => award.awardCode === "BOB")?.pointsAwarded, 0, "Year 16-style calls without published thresholds retain no breed-level BOB upgrade");

console.log("Breed-level Championship upgrade checks passed.");
