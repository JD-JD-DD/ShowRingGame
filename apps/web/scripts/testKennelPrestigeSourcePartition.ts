import { strict as assert } from "node:assert";

import { partitionKennelPrestigeSourcesByBreed } from "@/server/services/kennelPrestigeSourcePartition";

const championDogs = [
  { id: "champion-gr", breedCode2: "GR", kennelId: "shared" },
  { id: "champion-pd", breedCode2: "PD", kennelId: "shared", deceased: true },
];
const pointAwards = [
  { id: "point-gr", breedCode2: "GR", dogBreedCode2: "PD", kennelId: "historic" },
  { id: "point-pd", breedCode2: "PD", kennelId: "historic" },
];
const majorAwards = [
  { id: "major-pd", breedCode2: "PD" },
  { id: "major-gr", breedCode2: "GR" },
];
const currentYearStats = [
  { id: "stat-gr", breedCode2: "GR", ownerKennelId: "shared" },
  { id: "stat-pd", breedCode2: "PD", breederKennelId: "shared" },
];
const grandChampionDogs = [
  { id: "gch-gr", breedCode2: "GR", ownerKennelId: "transferred" },
  { id: "gch-pd", breedCode2: "PD", deceased: true },
];
const grandChampionCompletionEntries = [
  { dogId: "gch-pd", showDayId: "day-2", handlerUsed: true },
  { dogId: "gch-gr", showDayId: "day-1", handlerUsed: false },
  { dogId: "not-gch", showDayId: "day-3", handlerUsed: false },
];
const sources = { championDogs, pointAwards, majorAwards, currentYearStats, grandChampionDogs, grandChampionCompletionEntries };
const partitions = partitionKennelPrestigeSourcesByBreed(sources);

assert.deepEqual(partitions.championDogs.get("GR"), [championDogs[0]]);
assert.deepEqual(partitions.championDogs.get("PD"), [championDogs[1]]);
assert.deepEqual(partitions.pointAwards.get("GR"), [pointAwards[0]], "award uses ShowAward breed, not dog breed");
assert.deepEqual(partitions.majorAwards.get("PD"), [majorAwards[0]]);
assert.deepEqual(partitions.currentYearStats.get("GR"), [currentYearStats[0]]);
assert.deepEqual(partitions.grandChampionDogs.get("PD"), [grandChampionDogs[1]]);
assert.deepEqual(partitions.grandChampionCompletionEntries.get("GR"), [grandChampionCompletionEntries[1]]);
assert.deepEqual(partitions.grandChampionCompletionEntries.get("PD"), [grandChampionCompletionEntries[0]]);
assert.deepEqual(partitions.forBreed("ZZ"), {
  championDogs: [], pointAwards: [], majorAwards: [], currentYearStats: [], grandChampionDogs: [], grandChampionCompletionEntries: [],
});
assert.equal(partitions.pointAwards.get("GR")?.[0], pointAwards[0]);
assert.equal(partitions.grandChampionCompletionEntries.get("GR")?.[0], grandChampionCompletionEntries[1]);
assert.deepEqual(sources, { championDogs, pointAwards, majorAwards, currentYearStats, grandChampionDogs, grandChampionCompletionEntries });

console.log("Kennel prestige source partition checks passed.");
