import { PrismaClient } from "@prisma/client";
import {
  generateFoundationPhenotypeHealthTruths,
  inheritPhenotypeHealthTruths,
  PHENOTYPE_HEALTH_TEST_CODES,
  revealPhenotypeHealthTestResult,
  type PhenotypeHealthTestCode,
} from "@showring/rules";

import { createDeterministicPhenotypeHealthRandom } from "../server/services/healthTest.service";

const db = new PrismaClient();
const BATCH_SIZE = 100;

type Distribution = Record<string, number>;
type HiddenHealthTruth = {
  conditionCode: PhenotypeHealthTestCode;
  geneticLiability: number;
  environmentModifier: number;
};

function formatRate(count: number, totalDogs: number): string {
  return `${((count / totalDogs) * 100).toFixed(1)}%`;
}

async function backfillOldestFirst(): Promise<void> {
  const dogs = await db.dog.findMany({
    orderBy: [{ birthEpoch: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      sireId: true,
      damId: true,
      coiPercent: true,
    },
  });
  const existingTruths = await db.dogHealthConditionTruth.findMany({
    where: {
      conditionCode: {
        in: [...PHENOTYPE_HEALTH_TEST_CODES],
      },
    },
    select: {
      dogId: true,
      conditionCode: true,
      geneticLiability: true,
      environmentModifier: true,
    },
  });
  const dogsById = new Map(dogs.map((dog) => [dog.id, dog]));
  const truthsByDogId = new Map<string, HiddenHealthTruth[]>();
  const visitingDogIds = new Set<string>();
  const missingTruthRows: Array<{
    dogId: string;
    conditionCode: PhenotypeHealthTestCode;
    geneticLiability: number;
    environmentModifier: number;
  }> = [];

  console.log(`Backfilling phenotype health profiles for ${dogs.length} dogs.`);

  for (const truth of existingTruths) {
    const truths = truthsByDogId.get(truth.dogId) ?? [];

    if (PHENOTYPE_HEALTH_TEST_CODES.includes(truth.conditionCode as PhenotypeHealthTestCode)) {
      truths.push({
        conditionCode: truth.conditionCode as PhenotypeHealthTestCode,
        geneticLiability: truth.geneticLiability,
        environmentModifier: truth.environmentModifier,
      });
    }

    truthsByDogId.set(truth.dogId, truths);
  }

  function ensureInMemory(dogId: string): HiddenHealthTruth[] {
    const existing = truthsByDogId.get(dogId);

    if (existing?.length === PHENOTYPE_HEALTH_TEST_CODES.length) {
      return existing;
    }

    if (visitingDogIds.has(dogId)) {
      throw new Error("Cannot backfill health profiles for a cyclic pedigree.");
    }

    const dog = dogsById.get(dogId);

    if (!dog) {
      throw new Error(`Dog ${dogId} not found during health backfill.`);
    }

    visitingDogIds.add(dogId);

    try {
      const random01 = createDeterministicPhenotypeHealthRandom(dog.id);
      const generated =
        dog.sireId && dog.damId
          ? inheritPhenotypeHealthTruths({
              sireTruths: ensureInMemory(dog.sireId),
              damTruths: ensureInMemory(dog.damId),
              coiPercent: dog.coiPercent,
              random01,
            })
          : generateFoundationPhenotypeHealthTruths(random01);
      const existingByCode = new Map(
        (existing ?? []).map((truth) => [truth.conditionCode, truth])
      );
      const completed = generated.map(
        (truth) => existingByCode.get(truth.conditionCode) ?? truth
      );

      for (const truth of generated) {
        if (existingByCode.has(truth.conditionCode)) continue;

        missingTruthRows.push({
          dogId,
          conditionCode: truth.conditionCode,
          geneticLiability: truth.geneticLiability,
          environmentModifier: truth.environmentModifier,
        });
      }

      truthsByDogId.set(dogId, completed);
      return completed;
    } finally {
      visitingDogIds.delete(dogId);
    }
  }

  for (const dog of dogs) {
    ensureInMemory(dog.id);
  }

  console.log(`Persisting ${missingTruthRows.length} missing hidden rows.`);

  for (let start = 0; start < missingTruthRows.length; start += BATCH_SIZE) {
    const batch = missingTruthRows.slice(start, start + BATCH_SIZE);

    await db.dogHealthConditionTruth.createMany({
      data: batch,
      skipDuplicates: true,
    });

    console.log(
      `Persisted ${Math.min(start + batch.length, missingTruthRows.length)}/${missingTruthRows.length}.`
    );
  }
}

async function reportDistribution(): Promise<void> {
  const totalDogs = await db.dog.count();
  const truths = await db.dogHealthConditionTruth.findMany({
    where: {
      conditionCode: {
        in: [...PHENOTYPE_HEALTH_TEST_CODES],
      },
    },
    select: {
      conditionCode: true,
      geneticLiability: true,
      environmentModifier: true,
    },
  });

  console.log(`\nPersisted hidden rows: ${truths.length}`);

  for (const conditionCode of PHENOTYPE_HEALTH_TEST_CODES) {
    const distribution: Distribution = {};

    for (const truth of truths) {
      if (truth.conditionCode !== conditionCode) continue;

      const result = revealPhenotypeHealthTestResult({
        conditionCode: truth.conditionCode as PhenotypeHealthTestCode,
        geneticLiability: truth.geneticLiability,
        environmentModifier: truth.environmentModifier,
      });

      distribution[result.resultCode] =
        (distribution[result.resultCode] ?? 0) + 1;
    }

    const summary = Object.entries(distribution)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([resultCode, count]) => `${resultCode}=${formatRate(count, totalDogs)}`)
      .join(" ");

    console.log(`${conditionCode}: ${summary}`);
  }
}

async function main(): Promise<void> {
  try {
    await backfillOldestFirst();
    await reportDistribution();
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
