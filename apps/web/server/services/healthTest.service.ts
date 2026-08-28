import { db } from "@/lib/db";
import {
  generateFoundationPhenotypeHealthTruths,
  inheritPhenotypeHealthTruths,
  isPhenotypeHealthTestCode,
  getRequiredHealthTestsForBreed,
  PHENOTYPE_HEALTH_TEST_CODES,
  PHENOTYPE_HEALTH_TESTS,
  revealPhenotypeHealthTestResult,
  type PhenotypeHealthTruth,
  type PhenotypeHealthTestCode,
} from "@showring/rules";
import { Prisma } from "@prisma/client";

type HealthClient = Pick<
  Prisma.TransactionClient,
  | "dog"
  | "dogHealthConditionTruth"
  | "healthTestRecord"
  | "kennel"
  | "ledgerTransaction"
>;

type HealthPreviewClient = Pick<Prisma.TransactionClient, "dog">;

async function lockDogsForPhenotypeHealthTesting(
  tx: Prisma.TransactionClient,
  dogIds: string[]
) {
  await tx.$queryRaw(
    Prisma.sql`SELECT "id" FROM "Dog" WHERE "id" IN (${Prisma.join(dogIds)}) ORDER BY "id" FOR UPDATE`
  );
}

function getSafeBulkHealthTestErrorDetails(error: unknown) {
  const candidate =
    error && typeof error === "object"
      ? (error as { code?: unknown; name?: unknown })
      : undefined;

  return {
    errorName:
      typeof candidate?.name === "string" ? candidate.name : "UnknownError",
    errorCode: typeof candidate?.code === "string" ? candidate.code : undefined,
    errorMessage: error instanceof Error ? error.message : "Unknown error.",
  };
}

export type BulkHealthTestSelection =
  | {
      mode: "explicit";
      testTypeCodes: string[];
    }
  | {
      mode: "all-applicable";
    };

export type BulkHealthTestPreviewSkipReason =
  | "NOT_OWNED_OR_NOT_FOUND"
  | "NOT_ALIVE"
  | "NOT_APPLICABLE_TO_BREED"
  | "TOO_YOUNG"
  | "ALREADY_COMPLETED";

export class BulkHealthTestPreviewError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
  }
}

function normalizePreviewDogIds(dogIds: unknown): string[] {
  if (!Array.isArray(dogIds) || dogIds.length === 0) {
    throw new BulkHealthTestPreviewError("Choose at least one dog.");
  }

  const normalizedDogIds: string[] = [];

  for (const dogId of dogIds) {
    if (typeof dogId !== "string" || !dogId.trim()) {
      throw new BulkHealthTestPreviewError("Each dog ID must be a non-empty string.");
    }

    normalizedDogIds.push(dogId.trim());
  }

  return [...new Set(normalizedDogIds)];
}

function normalizeBulkHealthTestSelection(
  selection: unknown
):
  | { mode: "explicit"; testTypeCodes: PhenotypeHealthTestCode[] }
  | { mode: "all-applicable" } {
  if (!selection || typeof selection !== "object" || Array.isArray(selection)) {
    throw new BulkHealthTestPreviewError("A health test selection is required.");
  }

  const candidate = selection as { mode?: unknown; testTypeCodes?: unknown };

  if (candidate.mode === "all-applicable") {
    return { mode: "all-applicable" };
  }

  if (candidate.mode !== "explicit" || !Array.isArray(candidate.testTypeCodes)) {
    throw new BulkHealthTestPreviewError("Choose explicit tests or all applicable tests.");
  }

  if (candidate.testTypeCodes.length === 0) {
    throw new BulkHealthTestPreviewError("Choose at least one health test.");
  }

  const testTypeCodes: PhenotypeHealthTestCode[] = [];

  for (const testTypeCode of candidate.testTypeCodes) {
    if (typeof testTypeCode !== "string" || !isPhenotypeHealthTestCode(testTypeCode)) {
      throw new BulkHealthTestPreviewError("That health test is not available.");
    }

    if (!testTypeCodes.includes(testTypeCode)) {
      testTypeCodes.push(testTypeCode);
    }
  }

  return { mode: "explicit", testTypeCodes };
}

function emptySkippedByReason(): Record<BulkHealthTestPreviewSkipReason, number> {
  return {
    NOT_OWNED_OR_NOT_FOUND: 0,
    NOT_ALIVE: 0,
    NOT_APPLICABLE_TO_BREED: 0,
    TOO_YOUNG: 0,
    ALREADY_COMPLETED: 0,
  };
}

export async function previewBulkPhenotypeHealthTestsForKennel(args: {
  kennelId: string;
  dogIds: unknown;
  selection: unknown;
  currentEpoch: number;
  client?: HealthPreviewClient;
}) {
  const dogIds = normalizePreviewDogIds(args.dogIds);
  const selection = normalizeBulkHealthTestSelection(args.selection);
  const client = args.client ?? db;
  const dogs = await client.dog.findMany({
    where: { id: { in: dogIds } },
    select: {
      id: true,
      ownerKennelId: true,
      lifecycleState: true,
      birthEpoch: true,
      breedCode2: true,
      healthTests: {
        where: { testTypeCode: { in: [...PHENOTYPE_HEALTH_TEST_CODES] } },
        select: { testTypeCode: true },
      },
    },
  });
  const dogsById = new Map(dogs.map((dog) => [dog.id, dog]));
  const byTest = Object.fromEntries(
    PHENOTYPE_HEALTH_TEST_CODES.map((testTypeCode) => [
      testTypeCode,
      { runnableCount: 0, estimatedCost: 0 },
    ])
  ) as Record<PhenotypeHealthTestCode, { runnableCount: number; estimatedCost: number }>;
  const skippedByReason = emptySkippedByReason();
  let eligibleDogCount = 0;
  let runnableTestCount = 0;
  let estimatedTotalCost = 0;

  for (const dogId of dogIds) {
    const dog = dogsById.get(dogId);

    if (!dog || dog.ownerKennelId !== args.kennelId) {
      skippedByReason.NOT_OWNED_OR_NOT_FOUND += 1;
      continue;
    }

    const applicableTestCodes = getRequiredHealthTestsForBreed(dog.breedCode2);
    const requestedTestCodes =
      selection.mode === "all-applicable"
        ? applicableTestCodes
        : selection.testTypeCodes;

    if (dog.lifecycleState !== "ALIVE") {
      skippedByReason.NOT_ALIVE += requestedTestCodes.length;
      continue;
    }

    const completedTestCodes = new Set(dog.healthTests.map((test) => test.testTypeCode));
    const currentAgeHours = getAgeHours(args.currentEpoch, dog.birthEpoch);
    let hasRunnableTest = false;

    for (const testTypeCode of requestedTestCodes) {
      if (!applicableTestCodes.includes(testTypeCode)) {
        skippedByReason.NOT_APPLICABLE_TO_BREED += 1;
        continue;
      }

      const definition = PHENOTYPE_HEALTH_TESTS[testTypeCode];

      if (currentAgeHours < definition.minimumAgeHours) {
        skippedByReason.TOO_YOUNG += 1;
        continue;
      }

      if (completedTestCodes.has(testTypeCode)) {
        skippedByReason.ALREADY_COMPLETED += 1;
        continue;
      }

      hasRunnableTest = true;
      runnableTestCount += 1;
      estimatedTotalCost += definition.fee;
      byTest[testTypeCode].runnableCount += 1;
      byTest[testTypeCode].estimatedCost += definition.fee;
    }

    if (hasRunnableTest) {
      eligibleDogCount += 1;
    }
  }

  return {
    selectedDogCount: dogIds.length,
    eligibleDogCount,
    runnableTestCount,
    estimatedTotalCost,
    byTest,
    skippedByReason,
  };
}

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
): Promise<Map<string, PhenotypeHealthTruth[]>> {
  const uniqueDogIds = [...new Set(dogIds)].filter(Boolean);

  if (uniqueDogIds.length === 0) {
    return new Map();
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
    return resolvedTruthsByDogId;
  }

  await client.dogHealthConditionTruth.createMany({
    data: rowsToCreate,
    skipDuplicates: true,
  });

  return resolvedTruthsByDogId;
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

type HealthExecutionDog = {
  id: string;
  regNumber: string;
};

async function executePhenotypeHealthTestsForKennelTx(
  tx: HealthClient,
  args: {
    kennelId: string;
    dog: HealthExecutionDog;
    testTypeCodes: PhenotypeHealthTestCode[];
    currentEpoch: number;
    runningBalance: { value: number };
  }
) {
  await ensurePhenotypeHealthTruthsForDogs(tx, [args.dog.id]);

  const truths = await tx.dogHealthConditionTruth.findMany({
    where: {
      dogId: args.dog.id,
      conditionCode: { in: args.testTypeCodes },
    },
    select: {
      conditionCode: true,
      geneticLiability: true,
      environmentModifier: true,
    },
  });
  const truthByCode = new Map(truths.map((truth) => [truth.conditionCode, truth]));

  if (args.testTypeCodes.some((testTypeCode) => !truthByCode.has(testTypeCode))) {
    throw new Error("Health profile could not be generated.");
  }

  const createdRecords = [];

  for (const testTypeCode of args.testTypeCodes) {
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
    args.runningBalance.value -= definition.fee;

    await tx.ledgerTransaction.create({
      data: {
        kennelId: args.kennelId,
        transactionType: "HEALTH_TEST_FEE",
        amount: -definition.fee,
        balanceAfter: args.runningBalance.value,
        occurredAtEpoch: args.currentEpoch,
        dogId: args.dog.id,
        memo: `${definition.label} screening for ${args.dog.regNumber}.`,
        metadataJson: { testTypeCode },
      },
    });

    createdRecords.push(
      await tx.healthTestRecord.create({
        data: {
          dogId: args.dog.id,
          testTypeCode,
          resultCode: result.resultCode,
          testedAtEpoch: args.currentEpoch,
          revealedAtEpoch: args.currentEpoch,
          isPublic: true,
          notes: "Phenotype screening result.",
          detailsJson: { screeningType: "PHENOTYPE" },
        },
      })
    );
  }

  return createdRecords;
}

export function prepareBulkPhenotypeHealthTestPersistence(args: {
  kennelId: string;
  executionPlan: Array<{
    dog: HealthExecutionDog;
    testTypeCodes: PhenotypeHealthTestCode[];
  }>;
  truthsByDogId: Map<string, PhenotypeHealthTruth[]>;
  currentEpoch: number;
  runningBalance: { value: number };
  onPrepared: () => void;
}) {
  const healthTestRecords: Prisma.HealthTestRecordCreateManyInput[] = [];
  const ledgerTransactions: Prisma.LedgerTransactionCreateManyInput[] = [];

  for (const item of args.executionPlan) {
    const truthByCode = new Map(
      (args.truthsByDogId.get(item.dog.id) ?? []).map((truth) => [
        truth.conditionCode,
        truth,
      ])
    );

    for (const testTypeCode of item.testTypeCodes) {
      const truth = truthByCode.get(testTypeCode);

      if (!truth) {
        throw new Error("Health profile could not be generated.");
      }

      const definition = PHENOTYPE_HEALTH_TESTS[testTypeCode];
      const result = revealPhenotypeHealthTestResult({
        conditionCode: testTypeCode,
        geneticLiability: truth.geneticLiability,
        environmentModifier: truth.environmentModifier,
      });
      args.runningBalance.value -= definition.fee;

      healthTestRecords.push({
        dogId: item.dog.id,
        testTypeCode,
        resultCode: result.resultCode,
        testedAtEpoch: args.currentEpoch,
        revealedAtEpoch: args.currentEpoch,
        isPublic: true,
        notes: "Phenotype screening result.",
        detailsJson: { screeningType: "PHENOTYPE" },
      });
      ledgerTransactions.push({
        kennelId: args.kennelId,
        transactionType: "HEALTH_TEST_FEE",
        amount: -definition.fee,
        balanceAfter: args.runningBalance.value,
        occurredAtEpoch: args.currentEpoch,
        dogId: item.dog.id,
        memo: `${definition.label} screening for ${item.dog.regNumber}.`,
        metadataJson: { testTypeCode },
      });
      args.onPrepared();
    }
  }

  return { healthTestRecords, ledgerTransactions };
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
    await lockDogsForPhenotypeHealthTesting(tx, [dogId]);

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

    await tx.kennel.update({
      where: { id: kennel.id },
      data: {
        balance: kennel.balance - totalFee,
      },
    });

    return executePhenotypeHealthTestsForKennelTx(tx, {
      kennelId: kennel.id,
      dog,
      testTypeCodes,
      currentEpoch,
      runningBalance: { value: kennel.balance },
    });
  });
}

export async function runBulkPhenotypeHealthTestsForKennel(args: {
  kennelId: string;
  dogIds: unknown;
  selection: unknown;
  currentEpoch: number;
}) {
  const dogIds = normalizePreviewDogIds(args.dogIds);
  const selection = normalizeBulkHealthTestSelection(args.selection);
  const startedAt = Date.now();
  let transactionStartedAt: number | undefined;
  let phase = "transactionStart";
  let plannedTestCount = 0;
  let processedTestCount = 0;

  console.info("Bulk health test execution started", {
    operation: "bulk-health-tests",
    kennelId: args.kennelId,
    selectedDogCount: dogIds.length,
    phase,
  });

  try {
    const result = await db.$transaction(async (tx) => {
      transactionStartedAt = Date.now();
      phase = "dogLock";
      await lockDogsForPhenotypeHealthTesting(tx, dogIds);

    phase = "loadCurrentState";
    const dogs = await tx.dog.findMany({
      where: { id: { in: dogIds } },
      select: {
        id: true,
        regNumber: true,
        ownerKennelId: true,
        lifecycleState: true,
        birthEpoch: true,
        breedCode2: true,
        healthTests: {
          where: { testTypeCode: { in: [...PHENOTYPE_HEALTH_TEST_CODES] } },
          select: { testTypeCode: true },
        },
      },
    });
    phase = "buildExecutionPlan";
    const dogsById = new Map(dogs.map((dog) => [dog.id, dog]));
    const skippedByReason = emptySkippedByReason();
    const executionPlan: Array<{
      dog: HealthExecutionDog;
      testTypeCodes: PhenotypeHealthTestCode[];
    }> = [];
    const executedByTest = Object.fromEntries(
      PHENOTYPE_HEALTH_TEST_CODES.map((testTypeCode) => [testTypeCode, 0])
    ) as Record<PhenotypeHealthTestCode, number>;

    for (const dogId of dogIds) {
      const dog = dogsById.get(dogId);

      if (!dog || dog.ownerKennelId !== args.kennelId) {
        skippedByReason.NOT_OWNED_OR_NOT_FOUND += 1;
        continue;
      }

      const applicableTestCodes = getRequiredHealthTestsForBreed(dog.breedCode2);
      const requestedTestCodes =
        selection.mode === "all-applicable"
          ? applicableTestCodes
          : selection.testTypeCodes;

      if (dog.lifecycleState !== "ALIVE") {
        skippedByReason.NOT_ALIVE += requestedTestCodes.length;
        continue;
      }

      const completedTestCodes = new Set(dog.healthTests.map((test) => test.testTypeCode));
      const currentAgeHours = getAgeHours(args.currentEpoch, dog.birthEpoch);
      const runnableTestCodes: PhenotypeHealthTestCode[] = [];

      for (const testTypeCode of requestedTestCodes) {
        if (!applicableTestCodes.includes(testTypeCode)) {
          skippedByReason.NOT_APPLICABLE_TO_BREED += 1;
          continue;
        }

        const definition = PHENOTYPE_HEALTH_TESTS[testTypeCode];

        if (currentAgeHours < definition.minimumAgeHours) {
          skippedByReason.TOO_YOUNG += 1;
          continue;
        }

        if (completedTestCodes.has(testTypeCode)) {
          skippedByReason.ALREADY_COMPLETED += 1;
          continue;
        }

        runnableTestCodes.push(testTypeCode);
      }

      if (runnableTestCodes.length > 0) {
        executionPlan.push({
          dog: { id: dog.id, regNumber: dog.regNumber },
          testTypeCodes: runnableTestCodes,
        });
      }
    }

    const kennel = await tx.kennel.findUnique({
      where: { id: args.kennelId },
      select: { id: true, balance: true },
    });

    if (!kennel) {
      throw new Error("Kennel not found.");
    }

    const totalCharged = executionPlan.reduce(
      (total, item) =>
        total + item.testTypeCodes.reduce(
          (itemTotal, testTypeCode) =>
            itemTotal + PHENOTYPE_HEALTH_TESTS[testTypeCode].fee,
          0
        ),
      0
    );
    plannedTestCount = executionPlan.reduce(
      (count, item) => count + item.testTypeCodes.length,
      0
    );

    phase = "fundsCheck";
    if (kennel.balance < totalCharged) {
      throw new Error(
        totalCharged === 0 || executionPlan.length === 1 && executionPlan[0].testTypeCodes.length === 1
          ? "Insufficient funds for that health test."
          : "Insufficient funds for the selected health tests."
      );
    }

    if (totalCharged === 0) {
      return {
        selectedDogCount: dogIds.length,
        testedDogCount: 0,
        executedTestCount: 0,
        totalCharged: 0,
        newBalance: kennel.balance,
        executedByTest,
        skippedByReason,
      };
    }

    phase = "loadHealthTruth";
    const truthsByDogId = await ensurePhenotypeHealthTruthsForDogs(
      tx,
      executionPlan.map((item) => item.dog.id)
    );
    const runningBalance = { value: kennel.balance };
    phase = "prepareResults";
    const { healthTestRecords, ledgerTransactions } =
      prepareBulkPhenotypeHealthTestPersistence({
        kennelId: kennel.id,
        executionPlan,
        truthsByDogId,
        currentEpoch: args.currentEpoch,
        runningBalance,
        onPrepared: () => {
          processedTestCount += 1;
        },
      });

    phase = "balanceDebit";
    await tx.kennel.update({
      where: { id: kennel.id },
      data: { balance: kennel.balance - totalCharged },
    });

    phase = "persistResults";
    await tx.healthTestRecord.createMany({ data: healthTestRecords });

    phase = "persistLedger";
    await tx.ledgerTransaction.createMany({ data: ledgerTransactions });

    for (const item of executionPlan) {
      for (const testTypeCode of item.testTypeCodes) {
        executedByTest[testTypeCode] += 1;
      }
    }

    phase = "transactionCommit";
    return {
      selectedDogCount: dogIds.length,
      testedDogCount: executionPlan.length,
      executedTestCount: executionPlan.reduce(
        (count, item) => count + item.testTypeCodes.length,
        0
      ),
      totalCharged,
      newBalance: runningBalance.value,
      executedByTest,
      skippedByReason,
    };
    }, { timeout: 15_000 });

    console.info("Bulk health test execution completed", {
      operation: "bulk-health-tests",
      outcome: "success",
      kennelId: args.kennelId,
      selectedDogCount: result.selectedDogCount,
      runnableTestCount: plannedTestCount,
      executedTestCount: result.executedTestCount,
      skippedCount: Object.values(result.skippedByReason).reduce(
        (count, skipped) => count + skipped,
        0
      ),
      durationMs: Date.now() - startedAt,
      transactionDurationMs: transactionStartedAt
        ? Date.now() - transactionStartedAt
        : undefined,
      phase,
    });

    return result;
  } catch (error) {
    console.error("Bulk health test execution failed", {
      operation: "bulk-health-tests",
      outcome: "failure",
      kennelId: args.kennelId,
      selectedDogCount: dogIds.length,
      runnableTestCount: plannedTestCount,
      plannedTestCount,
      processedTestCount,
      phase,
      durationMs: Date.now() - startedAt,
      transactionDurationMs: transactionStartedAt
        ? Date.now() - transactionStartedAt
        : undefined,
      ...getSafeBulkHealthTestErrorDetails(error),
    });
    throw error;
  }
}
