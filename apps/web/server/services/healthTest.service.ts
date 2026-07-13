import { db } from "@/lib/db";
import {
  generateFoundationPhenotypeHealthTruths,
  inheritPhenotypeHealthTruths,
  isPhenotypeHealthTestCode,
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

function getAgeHours(currentEpoch: number, birthEpoch: number): number {
  return Math.max(0, currentEpoch - birthEpoch);
}

type HealthTruthRow = {
  dogId: string;
  conditionCode: string;
  geneticLiability: number;
  environmentModifier: number;
};

type HealthDogRow = {
  id: string;
  sireId: string | null;
  damId: string | null;
  coiPercent: number | null;
};

function mapTruthRowsByDog(
  truths: HealthTruthRow[]
): Map<string, PhenotypeHealthTruth[]> {
  const truthsByDogId = new Map<string, PhenotypeHealthTruth[]>();

  for (const truth of truths) {
    if (!isPhenotypeHealthTestCode(truth.conditionCode)) {
      continue;
    }

    const dogTruths = truthsByDogId.get(truth.dogId) ?? [];
    dogTruths.push({
      conditionCode: truth.conditionCode,
      geneticLiability: truth.geneticLiability,
      environmentModifier: truth.environmentModifier,
    });
    truthsByDogId.set(truth.dogId, dogTruths);
  }

  return truthsByDogId;
}

async function loadPhenotypeHealthPedigree(
  client: HealthClient,
  dogIds: string[]
): Promise<Map<string, HealthDogRow>> {
  const dogsById = new Map<string, HealthDogRow>();
  let frontierIds = [...new Set(dogIds)].filter(Boolean);

  while (frontierIds.length > 0) {
    const dogs = await client.dog.findMany({
      where: {
        id: {
          in: frontierIds,
        },
      },
      select: {
        id: true,
        sireId: true,
        damId: true,
        coiPercent: true,
      },
    });

    const nextFrontierIds = new Set<string>();

    for (const dog of dogs) {
      dogsById.set(dog.id, dog);

      if (dog.sireId && !dogsById.has(dog.sireId)) {
        nextFrontierIds.add(dog.sireId);
      }

      if (dog.damId && !dogsById.has(dog.damId)) {
        nextFrontierIds.add(dog.damId);
      }
    }

    frontierIds = [...nextFrontierIds];
  }

  return dogsById;
}

function resolvePhenotypeHealthTruthsForDog(args: {
  dogId: string;
  dogsById: Map<string, HealthDogRow>;
  existingTruthsByDogId: Map<string, PhenotypeHealthTruth[]>;
  resolvedTruthsByDogId: Map<string, PhenotypeHealthTruth[]>;
  visitingDogIds: Set<string>;
  pendingWrites: Map<string, PhenotypeHealthTruth[]>;
}): PhenotypeHealthTruth[] {
  const memoizedTruths = args.resolvedTruthsByDogId.get(args.dogId);

  if (memoizedTruths) {
    return memoizedTruths;
  }

  const existingTruths = args.existingTruthsByDogId.get(args.dogId) ?? [];

  if (existingTruths.length === PHENOTYPE_HEALTH_TEST_CODES.length) {
    args.resolvedTruthsByDogId.set(args.dogId, existingTruths);
    return existingTruths;
  }

  if (args.visitingDogIds.has(args.dogId)) {
    throw new Error("Cannot generate health profile for a cyclic pedigree.");
  }

  const dog = args.dogsById.get(args.dogId);

  if (!dog) {
    throw new Error("Dog not found while generating health profile.");
  }

  args.visitingDogIds.add(args.dogId);

  try {
    const random01 = createDeterministicPhenotypeHealthRandom(dog.id);
    const generatedTruths =
      dog.sireId && dog.damId
        ? inheritPhenotypeHealthTruths({
            sireTruths: resolvePhenotypeHealthTruthsForDog({
              ...args,
              dogId: dog.sireId,
            }),
            damTruths: resolvePhenotypeHealthTruthsForDog({
              ...args,
              dogId: dog.damId,
            }),
            coiPercent: dog.coiPercent,
            random01,
          })
        : generateFoundationPhenotypeHealthTruths(random01);

    const existingTruthByCode = new Map(
      existingTruths.map((truth) => [truth.conditionCode, truth] as const)
    );
    const completedTruths = generatedTruths.map(
      (truth) => existingTruthByCode.get(truth.conditionCode) ?? truth
    );
    const missingTruths = generatedTruths.filter(
      (truth) => !existingTruthByCode.has(truth.conditionCode)
    );

    if (missingTruths.length > 0) {
      args.pendingWrites.set(args.dogId, missingTruths);
    }

    args.resolvedTruthsByDogId.set(args.dogId, completedTruths);
    return completedTruths;
  } finally {
    args.visitingDogIds.delete(args.dogId);
  }
}

export async function ensurePhenotypeHealthTruthsForDogs(
  client: HealthClient,
  dogIds: string[]
): Promise<void> {
  const uniqueDogIds = [...new Set(dogIds)].filter(Boolean);

  if (uniqueDogIds.length === 0) {
    return;
  }

  const dogsById = await loadPhenotypeHealthPedigree(client, uniqueDogIds);
  const existingTruthRows = await client.dogHealthConditionTruth.findMany({
    where: {
      dogId: {
        in: [...dogsById.keys()],
      },
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
  const existingTruthsByDogId = mapTruthRowsByDog(existingTruthRows);
  const resolvedTruthsByDogId = new Map<string, PhenotypeHealthTruth[]>();
  const pendingWrites = new Map<string, PhenotypeHealthTruth[]>();

  for (const dogId of uniqueDogIds) {
    resolvePhenotypeHealthTruthsForDog({
      dogId,
      dogsById,
      existingTruthsByDogId,
      resolvedTruthsByDogId,
      visitingDogIds: new Set<string>(),
      pendingWrites,
    });
  }

  const rowsToCreate = [...pendingWrites.entries()].flatMap(([dogId, truths]) =>
    truths.map((truth) => ({
      dogId,
      conditionCode: truth.conditionCode,
      geneticLiability: truth.geneticLiability,
      environmentModifier: truth.environmentModifier,
    }))
  );

  if (rowsToCreate.length === 0) {
    return;
  }

  await client.dogHealthConditionTruth.createMany({
    data: rowsToCreate,
    skipDuplicates: true,
  });
}

export async function runPhenotypeHealthTestForKennel(args: {
  kennelId: string;
  dogId: string;
  testTypeCode: string;
  currentEpoch: number;
}) {
  const [record] = await runPhenotypeHealthTestsForKennel({
    kennelId: args.kennelId,
    dogId: args.dogId,
    testTypeCodes: [args.testTypeCode],
    currentEpoch: args.currentEpoch,
  });

  return record;
}

export async function runPhenotypeHealthTestsForKennel(args: {
  kennelId: string;
  dogId: string;
  testTypeCodes: string[];
  currentEpoch: number;
}) {
  const { kennelId, dogId, currentEpoch } = args;
  const testTypeCodes: PhenotypeHealthTestCode[] = [];

  for (const testTypeCode of new Set(args.testTypeCodes)) {
    if (!isPhenotypeHealthTestCode(testTypeCode)) {
      throw new Error("That health test is not available.");
    }

    testTypeCodes.push(testTypeCode);
  }

  if (testTypeCodes.length === 0) {
    throw new Error("Choose at least one health test.");
  }

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

    const dogAgeHours = getAgeHours(currentEpoch, dog.birthEpoch);
    const unavailableTest = testTypeCodes.find(
      (testTypeCode) =>
        dogAgeHours < PHENOTYPE_HEALTH_TESTS[testTypeCode].minimumAgeHours
    );

    if (unavailableTest) {
      throw new Error(
        `${PHENOTYPE_HEALTH_TESTS[unavailableTest].label} is not available yet. ${PHENOTYPE_HEALTH_TESTS[unavailableTest].minimumAgeLabel}.`
      );
    }

    const existingTest = await tx.healthTestRecord.findFirst({
      where: {
        dogId,
        testTypeCode: {
          in: testTypeCodes,
        },
      },
      select: { id: true },
    });

    if (existingTest) {
      throw new Error("This dog has already completed that health test.");
    }

    const totalFee = testTypeCodes.reduce(
      (sum, testTypeCode) => sum + PHENOTYPE_HEALTH_TESTS[testTypeCode].fee,
      0
    );
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

    if (kennel.balance < totalFee) {
      throw new Error(
        testTypeCodes.length === 1
          ? "Insufficient funds for that health test."
          : "Insufficient funds for the selected health tests."
      );
    }

    await ensurePhenotypeHealthTruthsForDogs(tx, [dog.id]);

    const truths = await tx.dogHealthConditionTruth.findMany({
      where: {
        dogId,
        conditionCode: {
          in: testTypeCodes,
        },
      },
      select: {
        conditionCode: true,
        geneticLiability: true,
        environmentModifier: true,
      },
    });
    const truthByCode = new Map(
      truths.map((truth) => [truth.conditionCode, truth])
    );

    if (testTypeCodes.some((testTypeCode) => !truthByCode.has(testTypeCode))) {
      throw new Error("Health profile could not be generated.");
    }

    await tx.kennel.update({
      where: { id: kennel.id },
      data: {
        balance: kennel.balance - totalFee,
      },
    });

    const createdRecords = [];
    let runningBalance = kennel.balance;

    for (const testTypeCode of testTypeCodes) {
      const definition = PHENOTYPE_HEALTH_TESTS[testTypeCode];
      const truth = truthByCode.get(testTypeCode);

      if (!truth) {
        throw new Error("Health profile could not be generated.");
      }

      const result = revealPhenotypeHealthTestResult({
        conditionCode: testTypeCode,
        geneticLiability: truth.geneticLiability,
        environmentModifier: truth.environmentModifier,
      });
      runningBalance -= definition.fee;

      await tx.ledgerTransaction.create({
        data: {
          kennelId: kennel.id,
          transactionType: "HEALTH_TEST_FEE",
          amount: -definition.fee,
          balanceAfter: runningBalance,
          occurredAtEpoch: currentEpoch,
          dogId: dog.id,
          memo: `${definition.label} screening for ${dog.regNumber}.`,
          metadataJson: {
            testTypeCode,
          },
        },
      });

      createdRecords.push(
        await tx.healthTestRecord.create({
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
        })
      );
    }

    return createdRecords;
  });
}
