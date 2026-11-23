import { randomUUID } from "node:crypto";

import { createPerfTimer } from "@/lib/perf";
import { getReleasedBreedsGroupedByCanonicalShowGroup } from "@/server/services/breed.service";
import {
  claimWorkingBreedKennelPrestigeLeaderboardBreed,
  completeWorkingBreedKennelPrestigeLeaderboardBreed,
  createWorkingBreedKennelPrestigeLeaderboardGeneration,
  getCurrentWorkingBreedKennelPrestigeLeaderboardGeneration,
  releaseWorkingBreedKennelPrestigeLeaderboardBreedClaim,
} from "@/server/services/breedKennelPrestigeLeaderboard.service";
import { getKennelPrestigeLeaderboard } from "@/server/services/kennelPrestige.service";

export const DEFAULT_BREED_KENNEL_PRESTIGE_BATCH_SIZE = 1;

export async function processBreedKennelPrestigeLeaderboardBatch(args: {
  maxBreeds?: number;
  now?: () => Date;
} = {}) {
  const perf = createPerfTimer({ route: "service:breedKennelPrestigeLeaderboard.worker" });
  const maxBreeds = Math.max(1, args.maxBreeds ?? DEFAULT_BREED_KENNEL_PRESTIGE_BATCH_SIZE);
  let generation = await getCurrentWorkingBreedKennelPrestigeLeaderboardGeneration();
  let initialized = false;
  if (!generation) {
    const groups = await getReleasedBreedsGroupedByCanonicalShowGroup();
    try {
      await createWorkingBreedKennelPrestigeLeaderboardGeneration({ manifest: groups.flatMap((group) => group.breeds.map((breed) => ({ breedCode2: breed.code2, groupCode: group.groupCode }))) });
      initialized = true;
    } catch { /* a concurrent initializer won */ }
    generation = await getCurrentWorkingBreedKennelPrestigeLeaderboardGeneration();
  }
  if (!generation) return { outcome: "no_working_generation" as const, initialized, attempted: 0, completed: 0, remaining: 0 };
  let attempted = 0; let completed = 0; let conflicts = 0; let failures = 0;
  for (const manifest of generation.manifestBreeds.filter((breed) => !breed.completedAt)) {
    if (attempted >= maxBreeds) break;
    const token = randomUUID(); const now = args.now?.() ?? new Date();
    const claim = await claimWorkingBreedKennelPrestigeLeaderboardBreed({ generationId: generation.id, breedCode2: manifest.breedCode2, claimToken: token, now });
    if (!claim.count) { conflicts += 1; continue; }
    attempted += 1; const started = Date.now();
    try {
      const rows = await getKennelPrestigeLeaderboard({ breedCode2: manifest.breedCode2, take: 10 });
      await completeWorkingBreedKennelPrestigeLeaderboardBreed({ generationId: generation.id, breedCode2: manifest.breedCode2, claimToken: token, now: args.now?.() ?? new Date(), entries: rows.map((row) => ({ rank: row.rank, kennelId: row.kennel.id, kennelName: row.kennel.name, kennelSlug: row.kennel.slug, prestigeScore: row.prestige.score, tierLabel: row.prestige.tier.label, championsBred: row.prestige.metrics.championsBred, bestInShowWins: row.prestige.metrics.bestInShowWins })) });
      completed += 1; console.info("breed-kennel-prestige-leaderboard-breed", { generationId: generation.id, groupCode: manifest.groupCode, breedCode2: manifest.breedCode2, calculationDurationMs: Date.now() - started });
    } catch { failures += 1; await releaseWorkingBreedKennelPrestigeLeaderboardBreedClaim({ generationId: generation.id, breedCode2: manifest.breedCode2, claimToken: token }); }
  }
  const remaining = generation.manifestBreeds.filter((breed) => !breed.completedAt).length - completed;
  perf.log({ generationId: generation.id, attempted, completed, remaining, conflicts, failures });
  return { outcome: remaining === 0 ? "generation_calculation_complete" as const : completed ? "batch_processed" as const : "no_claimable_work" as const, initialized, generationId: generation.id, attempted, completed, remaining, conflicts, failures };
}
