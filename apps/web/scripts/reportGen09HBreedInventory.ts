// @ts-expect-error Next provides this runtime package without a declaration entrypoint.
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import { CURRENT_GENETICS_VERSION } from "@showring/rules";
import { db } from "@/lib/db";
import { resolveFoundationPopulationContext } from "@/server/services/foundationPopulationContext.service";

const breedCodes = ["SL", "BG", "DT", "AF", "IS", "FW"] as const;

async function main() {
  const inventory = await Promise.all(breedCodes.map(async breedCode2 => {
    const breed = await db.breed.findUnique({ where: { code2: breedCode2 }, select: { name: true, isActive: true, releaseVersion: true } });
    const livingPlayerDogs = { breedCode2, lifecycleState: "ALIVE" as const, ownerKennelId: { not: null }, isFoundation: false };
    const [livingPlayerOwned, currentGenotype, kennels, litters, snapshots, context] = await Promise.all([
      db.dog.count({ where: livingPlayerDogs }),
      db.dog.count({ where: { ...livingPlayerDogs, geneticsVersion: CURRENT_GENETICS_VERSION, genotype: { not: null } } }),
      db.dog.groupBy({ by: ["ownerKennelId"], where: livingPlayerDogs }),
      db.dog.groupBy({ by: ["litterId"], where: livingPlayerDogs }),
      db.breedGeneticBackgroundSnapshot.findMany({ where: { breedCode2 }, orderBy: [{ gameYear: "desc" }, { createdAt: "desc" }], select: { gameYear: true, snapshotEpoch: true, sourceStatus: true, usableDogCount: true, kennelCount: true, litterCount: true, qualifiesForLiveUpdate: true }, take: 5 }),
      resolveFoundationPopulationContext(breedCode2),
    ]);
    return { breedCode2, breed, livingPlayerOwned, currentGenotype, independentKennels: kennels.length, litterOrRootCohorts: litters.length, snapshots, resolver: context.phenotypeContext.source };
  }));
  console.log(JSON.stringify({ diagnostic: "GEN-09H read-only breed inventory", inventory }, null, 2));
}

main().finally(() => db.$disconnect());
