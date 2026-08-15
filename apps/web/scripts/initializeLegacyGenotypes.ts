import {
  CURRENT_GENETICS_VERSION,
  assertStoredLegacyGenotype,
  encodeGenotype,
  reconstructLegacyGenotype,
  type CanonicalGenotype,
} from "@showring/rules";
import { db } from "@/lib/db";
import {
  toRulesDogTraits,
  type PersistedDogTraitRecord,
} from "@/server/services/phenotypePersistence.service";

type LegacyDogRow = PersistedDogTraitRecord & {
  id: string;
  regNumber: string;
  sireId: string | null;
  damId: string | null;
  genotype: string | null;
  geneticsVersion: string | null;
};

type InitializationSummary = {
  examined: number;
  alreadyValidCurrent: number;
  newlyReconstructed: number;
  rootsOrNoUsableParents: number;
  oneParentReconstructions: number;
  twoParentReconstructions: number;
  failures: number;
  phenotypeMismatches: number;
  unsupportedVersionRows: number;
  pedigreeCycleRows: number;
};

function createSummary(): InitializationSummary {
  return {
    examined: 0,
    alreadyValidCurrent: 0,
    newlyReconstructed: 0,
    rootsOrNoUsableParents: 0,
    oneParentReconstructions: 0,
    twoParentReconstructions: 0,
    failures: 0,
    phenotypeMismatches: 0,
    unsupportedVersionRows: 0,
    pedigreeCycleRows: 0,
  };
}

/**
 * One-time GEN-03 operation. Invoke only with DATABASE_URL explicitly pointed
 * at a rehearsal/development database; it never writes phenotype or pedigree.
 */
export async function initializeLegacyGenotypes(): Promise<InitializationSummary> {
  const dogs = await db.dog.findMany({
    orderBy: { id: "asc" },
    select: {
      id: true,
      regNumber: true,
      sireId: true,
      damId: true,
      genotype: true,
      geneticsVersion: true,
      traitHead: true,
      traitForequarters: true,
      traitHindquarters: true,
      traitGait: true,
      traitCoat: true,
      traitSize: true,
      traitTemperament: true,
      traitShowShine: true,
      traitFeet: true,
      traitTopline: true,
    },
  });
  const dogsById = new Map<string, LegacyDogRow>(dogs.map((dog) => [dog.id, dog]));
  const reconstructedById = new Map<string, CanonicalGenotype>();
  const visiting = new Set<string>();
  const cycleDogIds = new Set<string>();
  const summary = createSummary();

  const initializeDog = async (dogId: string): Promise<CanonicalGenotype | undefined> => {
    const existing = reconstructedById.get(dogId);
    if (existing) return existing;
    const dog = dogsById.get(dogId);
    if (!dog) return undefined;
    if (visiting.has(dogId)) {
      cycleDogIds.add(dogId);
      return undefined;
    }

    visiting.add(dogId);
    try {
      const deterministicKey = `${CURRENT_GENETICS_VERSION}:${dog.id}:${dog.regNumber}`;
      const knownPhenotype = toRulesDogTraits(dog);

      if (dog.genotype !== null || dog.geneticsVersion !== null) {
        if (!dog.genotype || !dog.geneticsVersion || dog.geneticsVersion !== CURRENT_GENETICS_VERSION) {
          summary.unsupportedVersionRows += 1;
          summary.failures += 1;
          console.error("GEN-03 unsupported or incomplete stored genotype", { dogId: dog.id, regNumber: dog.regNumber });
          return undefined;
        }
        try {
          const genotype = assertStoredLegacyGenotype({
            genotype: dog.genotype,
            geneticsVersion: dog.geneticsVersion,
            knownPhenotype,
            deterministicKey,
          });
          reconstructedById.set(dog.id, genotype);
          summary.alreadyValidCurrent += 1;
          return genotype;
        } catch (error) {
          summary.phenotypeMismatches += 1;
          summary.failures += 1;
          console.error("GEN-03 stored genotype failed phenotype verification", {
            dogId: dog.id,
            regNumber: dog.regNumber,
            message: error instanceof Error ? error.message : String(error),
          });
          return undefined;
        }
      }

      // Sequential parent traversal avoids database-row ordering and ensures a
      // shared ancestor is initialized only once before its descendants.
      const sire = dog.sireId ? await initializeDog(dog.sireId) : undefined;
      const dam = dog.damId ? await initializeDog(dog.damId) : undefined;
      const parentCount = Number(sire !== undefined) + Number(dam !== undefined);
      const genotype = reconstructLegacyGenotype({
        deterministicKey,
        knownPhenotype,
        parents: { sire, dam },
      });
      const encodedGenotype = encodeGenotype(genotype);
      const persisted = await db.dog.update({
        where: { id: dog.id },
        data: { genotype: encodedGenotype, geneticsVersion: CURRENT_GENETICS_VERSION },
        select: { genotype: true, geneticsVersion: true },
      });
      const verified = assertStoredLegacyGenotype({
        genotype: persisted.genotype ?? "",
        geneticsVersion: persisted.geneticsVersion ?? "",
        knownPhenotype,
        deterministicKey,
      });
      reconstructedById.set(dog.id, verified);
      summary.newlyReconstructed += 1;
      if (parentCount === 0) summary.rootsOrNoUsableParents += 1;
      else if (parentCount === 1) summary.oneParentReconstructions += 1;
      else summary.twoParentReconstructions += 1;
      return verified;
    } catch (error) {
      summary.failures += 1;
      console.error("GEN-03 reconstruction failed", {
        dogId: dog.id,
        regNumber: dog.regNumber,
        message: error instanceof Error ? error.message : String(error),
      });
      return undefined;
    } finally {
      visiting.delete(dogId);
    }
  };

  for (const dog of [...dogs].sort((left, right) => left.id.localeCompare(right.id))) {
    summary.examined += 1;
    await initializeDog(dog.id);
  }
  summary.pedigreeCycleRows = cycleDogIds.size;
  if (cycleDogIds.size > 0) {
    console.error("GEN-03 pedigree cycles used deterministic no-parent fallback", {
      dogIds: [...cycleDogIds].sort(),
    });
  }
  console.info("GEN-03 legacy genotype initialization complete", summary);
  return summary;
}

initializeLegacyGenotypes()
  .catch((error) => {
    console.error("GEN-03 legacy genotype initialization terminated", error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
