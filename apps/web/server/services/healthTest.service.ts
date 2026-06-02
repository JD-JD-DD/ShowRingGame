import { db } from "@/lib/db";
import {
  generateFoundationPhenotypeHealthTruths,
  inheritPhenotypeHealthTruths,
  isPhenotypeHealthTestCode,
  MIN_BREED_AGE_HOURS,
  PHENOTYPE_HEALTH_TEST_CODES,
  PHENOTYPE_HEALTH_TESTS,
  revealPhenotypeHealthTestResult,
  type PhenotypeHealthTruth,
  type PhenotypeHealthTestCode,
} from "@showring/rules";
import type { Prisma } from "@prisma/client";

type HealthClient = Pick<
  Prisma.TransactionClient,
  | "dog"
  | "dogHealthConditionTruth"
  | "healthTestRecord"
  | "kennel"
  | "ledgerTransaction"
>;

function seeded01(seed: string): number {
  let hash = 2166136261;

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;

  return (hash >>> 0) / 0x100000000;
}

function createSeededRandom(seed: string): () => number {
  let noiseIndex = 0;

  return () => {
    const value = seeded01(`${seed}:${noiseIndex}`);
    noiseIndex += 1;
    return value;
  };
}

export function createDeterministicPhenotypeHealthRandom(
  dogId: string
): () => number {
  return createSeededRandom(`phenotype-health:${dogId}`);
}

function mapTruths(
  truths: Array<{
    conditionCode: string;
    geneticLiability: number;
    environmentModifier: number;
  }>
): PhenotypeHealthTruth[] {
  return truths
    .filter((truth) => isPhenotypeHealthTestCode(truth.conditionCode))
    .map((truth) => ({
      conditionCode: truth.conditionCode as PhenotypeHealthTestCode,
      geneticLiability: truth.geneticLiability,
      environmentModifier: truth.environmentModifier,
    }));
}

async function ensureDogPhenotypeHealthTruths(
  client: HealthClient,
  dogId: string,
  visitingDogIds: Set<string>,
  truthsByDogId: Map<string, PhenotypeHealthTruth[]>
): Promise<PhenotypeHealthTruth[]> {
  const memoizedTruths = truthsByDogId.get(dogId);

  if (memoizedTruths) {
    return memoizedTruths;
  }

  const existingTruths = await client.dogHealthConditionTruth.findMany({
    where: {
      dogId,
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

  if (existingTruths.length === PHENOTYPE_HEALTH_TEST_CODES.length) {
    const mappedTruths = mapTruths(existingTruths);
    truthsByDogId.set(dogId, mappedTruths);
    return mappedTruths;
  }

  if (visitingDogIds.has(dogId)) {
    throw new Error("Cannot generate health profile for a cyclic pedigree.");
  }

  visitingDogIds.add(dogId);

  try {
    const dog = await client.dog.findUnique({
      where: { id: dogId },
      select: {
        id: true,
        sireId: true,
        damId: true,
        coiPercent: true,
      },
    });

    if (!dog) {
      throw new Error("Dog not found while generating health profile.");
    }

    const random01 = createDeterministicPhenotypeHealthRandom(dog.id);
    let generatedTruths: PhenotypeHealthTruth[];

    if (dog.sireId && dog.damId) {
      const sireTruths = await ensureDogPhenotypeHealthTruths(
        client,
        dog.sireId,
        visitingDogIds,
        truthsByDogId
      );
      const damTruths = await ensureDogPhenotypeHealthTruths(
        client,
        dog.damId,
        visitingDogIds,
        truthsByDogId
      );

      generatedTruths = inheritPhenotypeHealthTruths({
        sireTruths,
        damTruths,
        coiPercent: dog.coiPercent,
        random01,
      });
    } else {
      generatedTruths = generateFoundationPhenotypeHealthTruths(random01);
    }

    const existingCodes = new Set(
      existingTruths.map((truth) => truth.conditionCode)
    );

    await client.dogHealthConditionTruth.createMany({
      data: generatedTruths
        .filter((truth) => !existingCodes.has(truth.conditionCode))
        .map((truth) => ({
          dogId,
          conditionCode: truth.conditionCode,
          geneticLiability: truth.geneticLiability,
          environmentModifier: truth.environmentModifier,
        })),
      skipDuplicates: true,
    });

    const existingTruthsByCondition = new Map(
      mapTruths(existingTruths).map((truth) => [truth.conditionCode, truth])
    );
    const completedTruths = generatedTruths.map(
      (truth) => existingTruthsByCondition.get(truth.conditionCode) ?? truth
    );

    truthsByDogId.set(dogId, completedTruths);
    return completedTruths;
  } finally {
    visitingDogIds.delete(dogId);
  }
}

export async function ensurePhenotypeHealthTruthsForDogs(
  client: HealthClient,
  dogIds: string[]
): Promise<void> {
  const truthsByDogId = new Map<string, PhenotypeHealthTruth[]>();

  for (const dogId of [...new Set(dogIds)]) {
    await ensureDogPhenotypeHealthTruths(
      client,
      dogId,
      new Set<string>(),
      truthsByDogId
    );
  }
}

export async function runPhenotypeHealthTestForKennel(args: {
  kennelId: string;
  dogId: string;
  testTypeCode: string;
  currentEpoch: number;
}) {
  const { kennelId, dogId, testTypeCode, currentEpoch } = args;

  if (!isPhenotypeHealthTestCode(testTypeCode)) {
    throw new Error("That health test is not available.");
  }

  const definition = PHENOTYPE_HEALTH_TESTS[testTypeCode];

  return db.$transaction(async (tx) => {
    const dog = await tx.dog.findUnique({
      where: { id: dogId },
      select: {
        id: true,
        regNumber: true,
        ownerKennelId: true,
        birthEpoch: true,
        lifecycleState: true,
      },
    });

    if (!dog) {
      throw new Error("Dog not found.");
    }

    if (dog.ownerKennelId !== kennelId) {
      throw new Error("You do not own this dog.");
    }

    if (dog.lifecycleState !== "ALIVE") {
      throw new Error("Only living dogs can complete health testing.");
    }

    if (currentEpoch - dog.birthEpoch < MIN_BREED_AGE_HOURS) {
      throw new Error("Health testing becomes available at breeding age.");
    }

    const existingTest = await tx.healthTestRecord.findFirst({
      where: {
        dogId,
        testTypeCode,
      },
      select: { id: true },
    });

    if (existingTest) {
      throw new Error("This dog has already completed that health test.");
    }

    const kennel = await tx.kennel.findUnique({
      where: { id: kennelId },
      select: {
        id: true,
        balance: true,
      },
    });

    if (!kennel) {
      throw new Error("Kennel not found.");
    }

    if (kennel.balance < definition.fee) {
      throw new Error("Insufficient funds for that health test.");
    }

    await ensurePhenotypeHealthTruthsForDogs(tx, [dog.id]);

    const truth = await tx.dogHealthConditionTruth.findUnique({
      where: {
        dogId_conditionCode: {
          dogId,
          conditionCode: testTypeCode,
        },
      },
      select: {
        conditionCode: true,
        geneticLiability: true,
        environmentModifier: true,
      },
    });

    if (!truth) {
      throw new Error("Health profile could not be generated.");
    }

    const result = revealPhenotypeHealthTestResult({
      conditionCode: testTypeCode,
      geneticLiability: truth.geneticLiability,
      environmentModifier: truth.environmentModifier,
    });
    const balanceAfter = kennel.balance - definition.fee;

    await tx.kennel.update({
      where: { id: kennel.id },
      data: {
        balance: balanceAfter,
      },
    });

    await tx.ledgerTransaction.create({
      data: {
        kennelId: kennel.id,
        transactionType: "HEALTH_TEST_FEE",
        amount: -definition.fee,
        balanceAfter,
        occurredAtEpoch: currentEpoch,
        dogId: dog.id,
        memo: `${definition.label} screening for ${dog.regNumber}.`,
        metadataJson: {
          testTypeCode,
        },
      },
    });

    return tx.healthTestRecord.create({
      data: {
        dogId: dog.id,
        testTypeCode,
        resultCode: result.resultCode,
        testedAtEpoch: currentEpoch,
        revealedAtEpoch: currentEpoch,
        isPublic: true,
        notes: "Phenotype screening result.",
        detailsJson: {
          screeningType: "PHENOTYPE",
        },
      },
    });
  });
}
