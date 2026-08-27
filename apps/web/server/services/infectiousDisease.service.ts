import {
  BRUCELLOSIS_DISEASE_CODE,
  BRUCELLOSIS_FOUNDATION_INFECTION_RATE,
  BRUCELLOSIS_TEST_FEE,
  BRUCELLOSIS_TEST_VALID_HOURS,
} from "@showring/rules";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { formatDogDisplayName } from "@/lib/dogNames";

export type BrucellosisTestResultCode = "NEGATIVE" | "POSITIVE";

type DiseaseClient = Prisma.TransactionClient;
type BrucellosisPreviewClient = Pick<Prisma.TransactionClient, "dog">;

export type BulkBrucellosisPreviewSkipReason =
  | "NOT_OWNED_OR_NOT_FOUND"
  | "NOT_ALIVE";

export class BulkBrucellosisPreviewError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
  }
}

export class BulkBrucellosisExecutionError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
  }
}

function getSafeBulkBrucellosisErrorDetails(error: unknown) {
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

function normalizeBulkBrucellosisDogIds(dogIds: unknown): string[] {
  if (!Array.isArray(dogIds) || dogIds.length === 0) {
    throw new BulkBrucellosisPreviewError("Choose at least one dog.");
  }

  const normalizedDogIds: string[] = [];

  for (const dogId of dogIds) {
    if (typeof dogId !== "string" || !dogId.trim()) {
      throw new BulkBrucellosisPreviewError(
        "Each dog ID must be a non-empty string."
      );
    }

    normalizedDogIds.push(dogId.trim());
  }

  return [...new Set(normalizedDogIds)];
}

function emptyBulkBrucellosisSkippedByReason(): Record<
  BulkBrucellosisPreviewSkipReason,
  number
> {
  return {
    NOT_OWNED_OR_NOT_FOUND: 0,
    NOT_ALIVE: 0,
  };
}

export async function previewBulkBrucellosisScreeningForKennel(args: {
  kennelId: string;
  dogIds: unknown;
  client?: BrucellosisPreviewClient;
}) {
  const dogIds = normalizeBulkBrucellosisDogIds(args.dogIds);
  const client = args.client ?? db;
  const dogs = await client.dog.findMany({
    where: { id: { in: dogIds } },
    select: {
      id: true,
      ownerKennelId: true,
      lifecycleState: true,
    },
  });
  const dogsById = new Map(dogs.map((dog) => [dog.id, dog]));
  const skippedByReason = emptyBulkBrucellosisSkippedByReason();
  let screenableDogCount = 0;

  for (const dogId of dogIds) {
    const dog = dogsById.get(dogId);

    if (!dog || dog.ownerKennelId !== args.kennelId) {
      skippedByReason.NOT_OWNED_OR_NOT_FOUND += 1;
      continue;
    }

    if (dog.lifecycleState !== "ALIVE") {
      skippedByReason.NOT_ALIVE += 1;
      continue;
    }

    screenableDogCount += 1;
  }

  return {
    selectedDogCount: dogIds.length,
    screenableDogCount,
    skippedDogCount: dogIds.length - screenableDogCount,
    estimatedTotalCost: screenableDogCount * BRUCELLOSIS_TEST_FEE,
    skippedByReason,
  };
}

type InfectionSource = {
  sourceDogId?: string | null;
  sourceBreedingAttemptId?: string | null;
};

export async function isDogInfectedWithBrucellosis(
  client: DiseaseClient,
  dogId: string
): Promise<boolean> {
  const infection = await client.dogInfectiousDiseaseStatus.findUnique({
    where: {
      dogId_diseaseCode: {
        dogId,
        diseaseCode: BRUCELLOSIS_DISEASE_CODE,
      },
    },
    select: {
      status: true,
    },
  });

  return infection?.status === "INFECTED";
}

export async function infectDogWithBrucellosis(
  client: DiseaseClient,
  args: {
    dogId: string;
    currentEpoch: number;
  } & InfectionSource
): Promise<void> {
  await client.dogInfectiousDiseaseStatus.upsert({
    where: {
      dogId_diseaseCode: {
        dogId: args.dogId,
        diseaseCode: BRUCELLOSIS_DISEASE_CODE,
      },
    },
    create: {
      dogId: args.dogId,
      diseaseCode: BRUCELLOSIS_DISEASE_CODE,
      status: "INFECTED",
      infectedAtEpoch: args.currentEpoch,
      sourceDogId: args.sourceDogId ?? null,
      sourceBreedingAttemptId: args.sourceBreedingAttemptId ?? null,
      notes: "Brucellosis infection is permanent in the current ruleset.",
    },
    update: {
      status: "INFECTED",
    },
  });
}

export async function maybeSeedFoundationBrucellosis(
  client: DiseaseClient,
  args: {
    dogId: string;
    currentEpoch: number;
    random01?: () => number;
  }
): Promise<boolean> {
  const random01 = args.random01 ?? Math.random;
  const infected = random01() < BRUCELLOSIS_FOUNDATION_INFECTION_RATE;

  if (infected) {
    await infectDogWithBrucellosis(client, {
      dogId: args.dogId,
      currentEpoch: args.currentEpoch,
      sourceDogId: null,
      sourceBreedingAttemptId: null,
    });
  }

  return infected;
}

export async function getValidNegativeBrucellosisTest(
  client: DiseaseClient,
  args: {
    dogId: string;
    currentEpoch: number;
  }
) {
  if (await isDogInfectedWithBrucellosis(client, args.dogId)) {
    return null;
  }

  return client.infectiousDiseaseTestRecord.findFirst({
    where: {
      dogId: args.dogId,
      diseaseCode: BRUCELLOSIS_DISEASE_CODE,
      resultCode: "NEGATIVE",
      validUntilEpoch: {
        gte: args.currentEpoch,
      },
    },
    orderBy: [{ testedAtEpoch: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      testedAtEpoch: true,
      validUntilEpoch: true,
    },
  });
}

export async function runBrucellosisTest(
  client: DiseaseClient,
  args: {
    dogId: string;
    currentEpoch: number;
    breedingAttemptId?: string | null;
  }
): Promise<{
  id: string;
  resultCode: BrucellosisTestResultCode;
  validUntilEpoch: number | null;
}> {
  const infected = await isDogInfectedWithBrucellosis(client, args.dogId);
  const resultCode: BrucellosisTestResultCode = infected
    ? "POSITIVE"
    : "NEGATIVE";
  const validUntilEpoch =
    resultCode === "NEGATIVE"
      ? args.currentEpoch + BRUCELLOSIS_TEST_VALID_HOURS
      : null;

  const record = await client.infectiousDiseaseTestRecord.create({
    data: {
      dogId: args.dogId,
      diseaseCode: BRUCELLOSIS_DISEASE_CODE,
      resultCode,
      testedAtEpoch: args.currentEpoch,
      validUntilEpoch,
      breedingAttemptId: args.breedingAttemptId ?? null,
      notes:
        resultCode === "POSITIVE"
          ? "Positive brucellosis screen."
          : "Negative brucellosis screen.",
    },
    select: {
      id: true,
      resultCode: true,
      validUntilEpoch: true,
    },
  });

  return {
    ...record,
    resultCode: record.resultCode as BrucellosisTestResultCode,
  };
}

type BrucellosisScreeningDog = {
  id: string;
  registeredName: string | null;
  callName: string | null;
  regNumber: string;
  visibleTitlePrefix: string | null;
  visibleTitleSuffix: string | null;
};

export async function executeBrucellosisScreeningForKennelTx(
  tx: DiseaseClient,
  args: {
    kennelId: string;
    dog: BrucellosisScreeningDog;
    currentEpoch: number;
    runningBalance: { value: number };
  }
) {
  const test = await runBrucellosisTest(tx, {
    dogId: args.dog.id,
    currentEpoch: args.currentEpoch,
  });
  args.runningBalance.value -= BRUCELLOSIS_TEST_FEE;

  await tx.ledgerTransaction.create({
    data: {
      kennelId: args.kennelId,
      transactionType: "HEALTH_TEST_FEE",
      amount: -BRUCELLOSIS_TEST_FEE,
      balanceAfter: args.runningBalance.value,
      occurredAtEpoch: args.currentEpoch,
      dogId: args.dog.id,
      memo: `Brucellosis screening for ${formatDogDisplayName(args.dog)}.`,
      metadataJson: {
        diseaseCode: BRUCELLOSIS_DISEASE_CODE,
        resultCode: test.resultCode,
      },
    },
  });

  return test;
}

export async function runBulkBrucellosisScreeningForKennel(args: {
  kennelId: string;
  dogIds: unknown;
  currentEpoch: number;
}) {
  const dogIds = normalizeBulkBrucellosisDogIds(args.dogIds);
  const startedAt = Date.now();
  let transactionStartedAt: number | undefined;
  let phase = "transactionStart";
  let screenableDogCount = 0;
  let processedScreeningCount = 0;

  console.info("Bulk brucellosis execution started", {
    operation: "bulk-brucellosis",
    kennelId: args.kennelId,
    selectedDogCount: dogIds.length,
    phase,
  });

  try {
    const result = await db.$transaction(async (tx) => {
      transactionStartedAt = Date.now();
      phase = "loadCurrentState";
    const dogs = await tx.dog.findMany({
      where: { id: { in: dogIds } },
      select: {
        id: true,
        ownerKennelId: true,
        lifecycleState: true,
        registeredName: true,
        callName: true,
        regNumber: true,
        visibleTitlePrefix: true,
        visibleTitleSuffix: true,
      },
    });
    phase = "buildExecutionPlan";
    const dogsById = new Map(dogs.map((dog) => [dog.id, dog]));
    const skippedByReason = emptyBulkBrucellosisSkippedByReason();
    const screenableDogs: BrucellosisScreeningDog[] = [];

    for (const dogId of dogIds) {
      const dog = dogsById.get(dogId);

      if (!dog || dog.ownerKennelId !== args.kennelId) {
        skippedByReason.NOT_OWNED_OR_NOT_FOUND += 1;
        continue;
      }

      if (dog.lifecycleState !== "ALIVE") {
        skippedByReason.NOT_ALIVE += 1;
        continue;
      }

      screenableDogs.push(dog);
    }
    screenableDogCount = screenableDogs.length;

    const kennel = await tx.kennel.findUnique({
      where: { id: args.kennelId },
      select: { id: true, balance: true },
    });

    if (!kennel) {
      throw new BulkBrucellosisExecutionError("Kennel not found.", 404);
    }

    const totalCharged = screenableDogs.length * BRUCELLOSIS_TEST_FEE;

    phase = "fundsCheck";
    if (kennel.balance < totalCharged) {
      throw new BulkBrucellosisExecutionError(
        "Insufficient funds for the selected brucellosis screenings."
      );
    }

    if (totalCharged === 0) {
      return {
        selectedDogCount: dogIds.length,
        screenedDogCount: 0,
        skippedDogCount: dogIds.length,
        totalCharged: 0,
        newBalance: kennel.balance,
        skippedByReason,
      };
    }

    phase = "balanceDebit";
    await tx.kennel.update({
      where: { id: kennel.id },
      data: { balance: kennel.balance - totalCharged },
    });

    const runningBalance = { value: kennel.balance };

    phase = "screeningProcessing";
    for (const dog of screenableDogs) {
      await executeBrucellosisScreeningForKennelTx(tx, {
        kennelId: kennel.id,
        dog,
        currentEpoch: args.currentEpoch,
        runningBalance,
      });
      processedScreeningCount += 1;
    }

    phase = "transactionCommit";
    return {
      selectedDogCount: dogIds.length,
      screenedDogCount: screenableDogs.length,
      skippedDogCount: dogIds.length - screenableDogs.length,
      totalCharged,
      newBalance: runningBalance.value,
      skippedByReason,
    };
    });

    console.info("Bulk brucellosis execution completed", {
      operation: "bulk-brucellosis",
      outcome: "success",
      kennelId: args.kennelId,
      selectedDogCount: result.selectedDogCount,
      screenableDogCount,
      screenedDogCount: result.screenedDogCount,
      skippedCount: result.skippedDogCount,
      processedScreeningCount,
      durationMs: Date.now() - startedAt,
      transactionDurationMs: transactionStartedAt
        ? Date.now() - transactionStartedAt
        : undefined,
      phase,
    });

    return result;
  } catch (error) {
    console.error("Bulk brucellosis execution failed", {
      operation: "bulk-brucellosis",
      outcome: "failure",
      kennelId: args.kennelId,
      selectedDogCount: dogIds.length,
      screenableDogCount,
      processedScreeningCount,
      phase,
      durationMs: Date.now() - startedAt,
      transactionDurationMs: transactionStartedAt
        ? Date.now() - transactionStartedAt
        : undefined,
      ...getSafeBulkBrucellosisErrorDetails(error),
    });
    throw error;
  }
}

export async function transmitBrucellosisThroughBreeding(
  client: DiseaseClient,
  args: {
    sireId: string;
    damId: string;
    currentEpoch: number;
    breedingAttemptId: string;
  }
): Promise<{
  sireWasInfected: boolean;
  damWasInfected: boolean;
  transmitted: boolean;
}> {
  const [sireWasInfected, damWasInfected] = await Promise.all([
    isDogInfectedWithBrucellosis(client, args.sireId),
    isDogInfectedWithBrucellosis(client, args.damId),
  ]);

  if (sireWasInfected && !damWasInfected) {
    await infectDogWithBrucellosis(client, {
      dogId: args.damId,
      currentEpoch: args.currentEpoch,
      sourceDogId: args.sireId,
      sourceBreedingAttemptId: args.breedingAttemptId,
    });
  }

  if (damWasInfected && !sireWasInfected) {
    await infectDogWithBrucellosis(client, {
      dogId: args.sireId,
      currentEpoch: args.currentEpoch,
      sourceDogId: args.damId,
      sourceBreedingAttemptId: args.breedingAttemptId,
    });
  }

  return {
    sireWasInfected,
    damWasInfected,
    transmitted: sireWasInfected || damWasInfected,
  };
}

export async function infectPuppiesFromDamBrucellosis(
  client: DiseaseClient,
  args: {
    damId: string;
    puppyDogIds: string[];
    currentEpoch: number;
    breedingAttemptId: string;
  }
): Promise<number> {
  const damInfected = await isDogInfectedWithBrucellosis(client, args.damId);

  if (!damInfected) {
    return 0;
  }

  for (const puppyDogId of args.puppyDogIds) {
    await infectDogWithBrucellosis(client, {
      dogId: puppyDogId,
      currentEpoch: args.currentEpoch,
      sourceDogId: args.damId,
      sourceBreedingAttemptId: args.breedingAttemptId,
    });
  }

  return args.puppyDogIds.length;
}
