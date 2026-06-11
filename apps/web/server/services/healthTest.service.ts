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
