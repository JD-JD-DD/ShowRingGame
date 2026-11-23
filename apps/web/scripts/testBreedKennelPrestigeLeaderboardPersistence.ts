import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  assertBreedLeaderboardEntries,
} from "../server/services/breedKennelPrestigeLeaderboard.service";

const root = process.cwd();
const schema = readFileSync(resolve(root, "prisma/schema.prisma"), "utf8");
const migration = readFileSync(
  resolve(root, "prisma/migrations/20261123120000_add_breed_kennel_prestige_leaderboard_generations/migration.sql"),
  "utf8"
);
const claimLeaseMigration = readFileSync(
  resolve(root, "prisma/migrations/20261124120000_add_breed_leaderboard_claim_expiration/migration.sql"),
  "utf8"
);
const service = readFileSync(
  resolve(root, "server/services/breedKennelPrestigeLeaderboard.service.ts"),
  "utf8"
);
const overallService = readFileSync(
  resolve(root, "server/services/kennelPrestigeLeaderboard.service.ts"),
  "utf8"
);

const entry = (rank: number) => ({
  rank,
  kennelId: `kennel-${rank}`,
  kennelName: `Kennel ${rank}`,
  kennelSlug: `kennel-${rank}`,
  prestigeScore: rank * 10,
  tierLabel: "Rising Kennel",
  championsBred: rank,
  bestInShowWins: 0,
});

assert.doesNotThrow(() => assertBreedLeaderboardEntries([]), "a completed breed may have zero rankings");
assert.doesNotThrow(() => assertBreedLeaderboardEntries(Array.from({ length: 10 }, (_, index) => entry(index + 1))));
assert.throws(() => assertBreedLeaderboardEntries([entry(1), entry(1)]), /unique/);
assert.throws(() => assertBreedLeaderboardEntries([entry(0)]), /one through ten/);
assert.throws(() => assertBreedLeaderboardEntries(Array.from({ length: 11 }, (_, index) => entry(index + 1))), /more than ten/);

assert.match(schema, /model BreedKennelPrestigeLeaderboardState/);
assert.match(schema, /model BreedKennelPrestigeLeaderboardGeneration/);
assert.match(schema, /model BreedKennelPrestigeLeaderboardManifestBreed/);
assert.match(schema, /model BreedKennelPrestigeLeaderboardEntry/);
assert.match(migration, /BreedKennelPrestigeLeaderboardState_singleton_check/);
assert.match(migration, /"rank" > 0 AND "rank" <= 10/);
assert.match(claimLeaseMigration, /ADD COLUMN "completionClaimExpiresAt" TIMESTAMP\(3\)/);
assert.match(migration, /UNIQUE INDEX "BKPL_entry_gen_breed_rank_uq"/);
assert.match(migration, /INDEX "BKPL_entry_gen_breed_rank_idx"/);
assert.match(service, /manifestBreeds: \{ createMany: \{ data: args\.manifest \} \}/);
assert.match(service, /completionClaimToken: args\.claimToken/);
assert.match(service, /BREED_KENNEL_PRESTIGE_LEADERBOARD_CLAIM_LEASE_MS = 10 \* 60 \* 1000/);
assert.match(service, /completionClaimExpiresAt: \{ lte: now \}/);
assert.match(service, /completionClaimExpiresAt: \{ gt: now \}/);
assert.match(service, /releaseWorkingBreedKennelPrestigeLeaderboardBreedClaim/);
assert.match(service, /completionClaimToken: null, completionClaimExpiresAt: null/);
assert.match(service, /deleteMany\(\{[\s\S]*generationId: args\.generationId, breedCode2: args\.breedCode2/);
assert.match(service, /completedAt: args\.completedAt \?\? now/);
assert.match(service, /Cannot publish an incomplete breed leaderboard generation/);
assert.match(service, /workingGenerationId: args\.generationId/);
assert.match(service, /take: 10/);
assert.match(service, /id: \{ notIn: activeGenerationIds \}/);
assert.doesNotMatch(service, /kennelPrestigeLeaderboardEntry|kennelPrestigeLeaderboardState/);
assert.doesNotMatch(overallService, /BreedKennelPrestigeLeaderboard/);

console.log("Breed kennel prestige leaderboard persistence checks passed.");
