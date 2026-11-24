import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(process.cwd(), "server/services/breedKennelPrestigeLeaderboardWorker.service.ts"), "utf8");

assert.match(source, /DEFAULT_BREED_KENNEL_PRESTIGE_BATCH_SIZE = 1/);
assert.match(source, /args\.maxBreeds \?\? DEFAULT_BREED_KENNEL_PRESTIGE_BATCH_SIZE/);
assert.match(source, /for \(const manifest of generation\.manifestBreeds\.filter/);
assert.match(source, /if \(attempted >= maxBreeds\) break/);
assert.match(source, /claimWorkingBreedKennelPrestigeLeaderboardBreed/);
assert.match(source, /completeWorkingBreedKennelPrestigeLeaderboardBreed/);
assert.doesNotMatch(source, /publishCompleteBreedKennelPrestigeLeaderboardGeneration/);
console.log("Breed kennel prestige leaderboard worker checks passed.");
