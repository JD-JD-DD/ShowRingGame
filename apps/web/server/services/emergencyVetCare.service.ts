import { db } from "@/lib/db";
import {
  type DogEmergencyCareEvent,
  type DogEmergencyCareStatus,
  type DogEmergencyCareType,
  type DogEmergencyTreatmentOutcome,
  type Prisma,
} from "@prisma/client";

import { formatDogDisplayName } from "@/lib/dogNames";

const BASIS_POINTS = 10_000;

export const EMERGENCY_VET_CARE_RESPONSE_WINDOW_HOURS = 48;

export type EmergencyVetCareCostTier = {
  treatmentCost: number;
  chanceBps: number;
  survivalChanceBps: number;
};

export const EMERGENCY_VET_CARE_COST_TIERS: readonly EmergencyVetCareCostTier[] =
  [
    { treatmentCost: 3_000, chanceBps: 5_000, survivalChanceBps: 9_500 },
    { treatmentCost: 5_000, chanceBps: 2_000, survivalChanceBps: 9_000 },
    { treatmentCost: 7_500, chanceBps: 1_200, survivalChanceBps: 8_200 },
    { treatmentCost: 10_000, chanceBps: 800, survivalChanceBps: 7_200 },
    { treatmentCost: 12_500, chanceBps: 500, survivalChanceBps: 6_200 },
    { treatmentCost: 15_000, chanceBps: 500, survivalChanceBps: 5_000 },
  ] as const;

export type PendingEmergencyCarePayload = {
  id: string;
  dogId: string;
  kennelIdAtEvent: string | null;
  emergencyType: DogEmergencyCareType;
  status: DogEmergencyCareStatus;
  createdAtEpoch: number;
  responseDeadlineEpoch: number;
  treatmentCost: number;
  survivalChanceBps: number;
};

export type EmergencyCareResolutionResult = {
  event: DogEmergencyCareEvent;
  dogDied: boolean;
};

export type EmergencyCareActionResponsePayload = {
  emergencyCareEvent: {
    id: string;
    dogId: string;
    status: DogEmergencyCareStatus;
    treatmentOutcome: DogEmergencyTreatmentOutcome | null;
    treatmentCost: number;
    survivalChanceBps: number;
    responseDeadlineEpoch: number;
    paidAtEpoch: number | null;
    resolvedAtEpoch: number | null;
  };
  dogDied: boolean;
  dogAlive: boolean;
  message: string;
};

export type ExpiredEmergencyCareProcessingResult = {
  processedCount: number;
  expiredCount: number;
  deceasedDogIds: string[];
};

export type EmergencyVetCareClient = {
  dogEmergencyCareEvent: {
    findFirst(
      args: Prisma.DogEmergencyCareEventFindFirstArgs
    ): Promise<DogEmergencyCareEvent | null>;
    create(
      args: Prisma.DogEmergencyCareEventCreateArgs
    ): Promise<DogEmergencyCareEvent>;
  };
};

type EmergencyCareDog = {
  id: string;
  regNumber: string;
  registeredName: string | null;
  callName: string | null;
  visibleTitlePrefix: string | null;
  visibleTitleSuffix: string | null;
  ownerKennelId: string | null;
  birthEpoch: number;
  lifecycleState: string;
  originType: string | null;
  litterId: string | null;
};

type PendingEmergencyWithDog = DogEmergencyCareEvent & {
  dog: EmergencyCareDog;
};

const DEFAULT_EXPIRATION_BATCH_SIZE = 100;
const MAX_EXPIRATION_BATCH_SIZE = 500;

function rollToBasisPoints(random01: number): number {
  if (!Number.isFinite(random01)) {
    throw new Error("Emergency vet-care roll must be a finite number.");
  }

  return Math.max(
    0,
    Math.min(BASIS_POINTS - 1, Math.floor(random01 * BASIS_POINTS))
  );
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

function createTreatmentOutcomeRollBps(event: DogEmergencyCareEvent): number {
  return rollToBasisPoints(
    seeded01(event.outcomeSeed ?? `emergency-vet-care:${event.id}`)
  );
}

function assertValidRollBps(rollBps: number): void {
  if (!Number.isInteger(rollBps) || rollBps < 0 || rollBps >= BASIS_POINTS) {
    throw new Error("Emergency vet-care roll must be an integer from 0 to 9999.");
  }
}

export function getEmergencyVetCareCostTierWeightTotalBps(): number {
  return EMERGENCY_VET_CARE_COST_TIERS.reduce(
    (total, tier) => total + tier.chanceBps,
    0
  );
}

export function selectEmergencyVetCareCostTierFromRollBps(
  rollBps: number
): EmergencyVetCareCostTier {
  assertValidRollBps(rollBps);

  let cumulativeBps = 0;
  for (const tier of EMERGENCY_VET_CARE_COST_TIERS) {
    cumulativeBps += tier.chanceBps;
    if (rollBps < cumulativeBps) {
      return tier;
    }
  }

  return EMERGENCY_VET_CARE_COST_TIERS[
    EMERGENCY_VET_CARE_COST_TIERS.length - 1
  ];
}

export function selectEmergencyVetCareCostTier(
  random01: number
): EmergencyVetCareCostTier {
  return selectEmergencyVetCareCostTierFromRollBps(rollToBasisPoints(random01));
}

export function selectTreatmentSurvivalOutcomeFromRollBps(args: {
  survivalChanceBps: number;
  rollBps: number;
}): DogEmergencyTreatmentOutcome {
  assertValidRollBps(args.rollBps);

  if (
    !Number.isInteger(args.survivalChanceBps) ||
    args.survivalChanceBps < 0 ||
    args.survivalChanceBps > BASIS_POINTS
  ) {
    throw new Error(
      "Emergency vet-care survival chance must be 0 to 10000 bps."
    );
  }

  return args.rollBps < args.survivalChanceBps
    ? "SURVIVED"
    : "DIED_DESPITE_TREATMENT";
}

export function selectTreatmentSurvivalOutcome(args: {
  survivalChanceBps: number;
  random01: number;
}): DogEmergencyTreatmentOutcome {
  return selectTreatmentSurvivalOutcomeFromRollBps({
    survivalChanceBps: args.survivalChanceBps,
    rollBps: rollToBasisPoints(args.random01),
  });
}

export function calculateEmergencyVetCareDeadlineEpoch(
  createdAtEpoch: number
): number {
  return createdAtEpoch + EMERGENCY_VET_CARE_RESPONSE_WINDOW_HOURS;
}

export function toPendingEmergencyCarePayload(
  event: Pick<
    DogEmergencyCareEvent,
    | "id"
    | "dogId"
    | "kennelIdAtEvent"
    | "emergencyType"
    | "status"
    | "createdAtEpoch"
    | "responseDeadlineEpoch"
    | "treatmentCost"
    | "survivalChanceBps"
  >
): PendingEmergencyCarePayload {
  return {
    id: event.id,
    dogId: event.dogId,
    kennelIdAtEvent: event.kennelIdAtEvent,
    emergencyType: event.emergencyType,
    status: event.status,
    createdAtEpoch: event.createdAtEpoch,
    responseDeadlineEpoch: event.responseDeadlineEpoch,
    treatmentCost: event.treatmentCost,
    survivalChanceBps: event.survivalChanceBps,
  };
}

export function toEmergencyCareActionResponsePayload(
  result: EmergencyCareResolutionResult
): EmergencyCareActionResponsePayload {
  const { event } = result;

  return {
    emergencyCareEvent: {
      id: event.id,
      dogId: event.dogId,
      status: event.status,
      treatmentOutcome: event.treatmentOutcome,
      treatmentCost: event.treatmentCost,
      survivalChanceBps: event.survivalChanceBps,
      responseDeadlineEpoch: event.responseDeadlineEpoch,
      paidAtEpoch: event.paidAtEpoch,
      resolvedAtEpoch: event.resolvedAtEpoch,
    },
    dogDied: result.dogDied,
    dogAlive: !result.dogDied,
    message: getEmergencyCareActionMessage(event.status),
  };
}

function getEmergencyCareActionMessage(status: DogEmergencyCareStatus): string {
  switch (status) {
    case "TREATED_SURVIVED":
      return "Emergency treatment was authorized and the dog survived.";
    case "TREATED_DIED":
      return "Emergency treatment was authorized, but the dog did not survive.";
    case "DECLINED_DIED":
      return "Emergency care was declined and the dog has died.";
    case "EXPIRED_DIED":
      return "Emergency care expired and the dog has died.";
    default:
      return "Emergency care action completed.";
  }
}

export async function getPendingEmergencyForDog(
  dogId: string,
  client: EmergencyVetCareClient = db
): Promise<DogEmergencyCareEvent | null> {
  return client.dogEmergencyCareEvent.findFirst({
    where: {
      dogId,
      status: "PENDING",
    },
    orderBy: {
      createdAtEpoch: "asc",
    },
  });
}

export async function assertDogHasNoPendingEmergencyCare(
  dogId: string,
  client: EmergencyVetCareClient = db
): Promise<void> {
  const pendingEmergency = await getPendingEmergencyForDog(dogId, client);

  if (pendingEmergency) {
    throw new Error("This dog has a pending emergency vet-care event.");
  }
}

export async function createPendingEmergencyForAccidentIllnessDeath(args: {
  dogId: string;
  kennelIdAtEvent?: string | null;
  createdAtEpoch: number;
  costRollBps: number;
  outcomeSeed?: string | null;
  client?: EmergencyVetCareClient;
}): Promise<DogEmergencyCareEvent> {
  const client = args.client ?? db;
  const existingPendingEmergency = await getPendingEmergencyForDog(
    args.dogId,
    client
  );

  if (existingPendingEmergency) {
    return existingPendingEmergency;
  }

  const costTier = selectEmergencyVetCareCostTierFromRollBps(args.costRollBps);

  return client.dogEmergencyCareEvent.create({
    data: {
      dogId: args.dogId,
      kennelIdAtEvent: args.kennelIdAtEvent ?? null,
      emergencyType: "ACCIDENT_ILLNESS",
      status: "PENDING",
      createdAtEpoch: args.createdAtEpoch,
      responseDeadlineEpoch: calculateEmergencyVetCareDeadlineEpoch(
        args.createdAtEpoch
      ),
      treatmentCost: costTier.treatmentCost,
      survivalChanceBps: costTier.survivalChanceBps,
      outcomeSeed: args.outcomeSeed ?? null,
    },
  });
}

function ensureEventBelongsToKennel(args: {
  event: PendingEmergencyWithDog;
  kennelId: string;
}): void {
  if (
    args.event.dog.ownerKennelId !== args.kennelId ||
    (args.event.kennelIdAtEvent && args.event.kennelIdAtEvent !== args.kennelId)
  ) {
    throw new Error("You do not own this emergency care event.");
  }
}

function ensureDogIsAlive(dog: EmergencyCareDog): void {
  if (dog.lifecycleState !== "ALIVE") {
    throw new Error("Only living dogs can receive emergency care.");
  }
}

async function markEmergencyDogDeceased(args: {
  tx: Prisma.TransactionClient;
  dog: EmergencyCareDog;
  currentEpoch: number;
}): Promise<boolean> {
  const { markDogDeceased } = await import(
    "@/server/services/lifecycle.service"
  );

  return markDogDeceased({
    client: args.tx,
    dogId: args.dog.id,
    regNumber: args.dog.regNumber,
    ownerKennelId: args.dog.ownerKennelId,
    displayName: formatDogDisplayName(args.dog),
    deathEpoch: args.currentEpoch,
    cause: "ACCIDENT_ILLNESS",
    birthEpoch: args.dog.birthEpoch,
    originType: args.dog.originType,
    litterId: args.dog.litterId,
  });
}

const pendingEmergencyWithDogSelect = {
  dog: {
    select: {
      id: true,
      regNumber: true,
      registeredName: true,
      callName: true,
      visibleTitlePrefix: true,
      visibleTitleSuffix: true,
      ownerKennelId: true,
      birthEpoch: true,
      lifecycleState: true,
      originType: true,
      litterId: true,
    },
  },
} satisfies Prisma.DogEmergencyCareEventInclude;

export async function authorizeEmergencyTreatment(args: {
  kennelId: string;
  dogId: string;
  currentEpoch: number;
  outcomeRollBps?: number;
}): Promise<EmergencyCareResolutionResult> {
  return db.$transaction(async (tx) => {
    const event = (await tx.dogEmergencyCareEvent.findFirst({
      where: {
        dogId: args.dogId,
        status: "PENDING",
      },
      include: pendingEmergencyWithDogSelect,
      orderBy: {
        createdAtEpoch: "asc",
      },
    })) as PendingEmergencyWithDog | null;

    if (!event) {
      throw new Error("No pending emergency care event found for this dog.");
    }

    ensureEventBelongsToKennel({ event, kennelId: args.kennelId });
    ensureDogIsAlive(event.dog);

    if (args.currentEpoch >= event.responseDeadlineEpoch) {
      throw new Error("Emergency care deadline has passed.");
    }

    const kennel = await tx.kennel.findUnique({
      where: { id: args.kennelId },
      select: {
        id: true,
        balance: true,
      },
    });

    if (!kennel) {
      throw new Error("Kennel not found.");
    }

    if (kennel.balance < event.treatmentCost) {
      throw new Error("Insufficient funds for emergency vet care.");
    }

    const outcomeRollBps =
      args.outcomeRollBps ?? createTreatmentOutcomeRollBps(event);
    const treatmentOutcome = selectTreatmentSurvivalOutcomeFromRollBps({
      survivalChanceBps: event.survivalChanceBps,
      rollBps: outcomeRollBps,
    });
    const status: DogEmergencyCareStatus =
      treatmentOutcome === "SURVIVED" ? "TREATED_SURVIVED" : "TREATED_DIED";
    const balanceAfter = kennel.balance - event.treatmentCost;

    await tx.kennel.update({
      where: { id: kennel.id },
      data: {
        balance: balanceAfter,
      },
    });

    const ledgerTransaction = await tx.ledgerTransaction.create({
      data: {
        kennelId: kennel.id,
        transactionType: "EMERGENCY_VET_CARE",
        amount: -event.treatmentCost,
        balanceAfter,
        occurredAtEpoch: args.currentEpoch,
        dogId: event.dogId,
        memo: `Emergency vet care for ${event.dog.regNumber}.`,
        metadataJson: {
          emergencyCareEventId: event.id,
          treatmentOutcome,
          outcomeRollBps,
        },
      },
    });

    const update = await tx.dogEmergencyCareEvent.updateMany({
      where: {
        id: event.id,
        status: "PENDING",
        responseDeadlineEpoch: {
          gt: args.currentEpoch,
        },
      },
      data: {
        status,
        paidAtEpoch: args.currentEpoch,
        resolvedAtEpoch: args.currentEpoch,
        treatmentOutcome,
        outcomeRollBps,
        ledgerTransactionId: ledgerTransaction.id,
      },
    });

    if (update.count === 0) {
      throw new Error("Emergency care has already been resolved.");
    }

    let dogDied = false;
    if (status === "TREATED_DIED") {
      dogDied = await markEmergencyDogDeceased({
        tx,
        dog: event.dog,
        currentEpoch: args.currentEpoch,
      });
    }

    const resolvedEvent = await tx.dogEmergencyCareEvent.findUniqueOrThrow({
      where: { id: event.id },
    });

    return {
      event: resolvedEvent,
      dogDied,
    };
  });
}

export async function declineEmergencyCare(args: {
  kennelId: string;
  dogId: string;
  currentEpoch: number;
}): Promise<EmergencyCareResolutionResult> {
  return db.$transaction(async (tx) => {
    const event = (await tx.dogEmergencyCareEvent.findFirst({
      where: {
        dogId: args.dogId,
        status: "PENDING",
      },
      include: pendingEmergencyWithDogSelect,
      orderBy: {
        createdAtEpoch: "asc",
      },
    })) as PendingEmergencyWithDog | null;

    if (!event) {
      throw new Error("No pending emergency care event found for this dog.");
    }

    ensureEventBelongsToKennel({ event, kennelId: args.kennelId });
    ensureDogIsAlive(event.dog);

    const update = await tx.dogEmergencyCareEvent.updateMany({
      where: {
        id: event.id,
        status: "PENDING",
      },
      data: {
        status: "DECLINED_DIED",
        resolvedAtEpoch: args.currentEpoch,
      },
    });

    if (update.count === 0) {
      throw new Error("Emergency care has already been resolved.");
    }

    const dogDied = await markEmergencyDogDeceased({
      tx,
      dog: event.dog,
      currentEpoch: args.currentEpoch,
    });
    const resolvedEvent = await tx.dogEmergencyCareEvent.findUniqueOrThrow({
      where: { id: event.id },
    });

    return {
      event: resolvedEvent,
      dogDied,
    };
  });
}

export async function processExpiredEmergencyCareEvents(args: {
  currentEpoch: number;
  limit?: number;
}): Promise<ExpiredEmergencyCareProcessingResult> {
  const limit =
    Number.isInteger(args.limit) && args.limit && args.limit > 0
      ? Math.min(args.limit, MAX_EXPIRATION_BATCH_SIZE)
      : DEFAULT_EXPIRATION_BATCH_SIZE;
  const expiredEvents = (await db.dogEmergencyCareEvent.findMany({
    where: {
      status: "PENDING",
      responseDeadlineEpoch: {
        lte: args.currentEpoch,
      },
    },
    include: pendingEmergencyWithDogSelect,
    orderBy: [{ responseDeadlineEpoch: "asc" }, { createdAt: "asc" }],
    take: limit,
  })) as PendingEmergencyWithDog[];
  const deceasedDogIds: string[] = [];
  let expiredCount = 0;

  for (const event of expiredEvents) {
    const result = await db.$transaction(async (tx) => {
      const update = await tx.dogEmergencyCareEvent.updateMany({
        where: {
          id: event.id,
          status: "PENDING",
          responseDeadlineEpoch: {
            lte: args.currentEpoch,
          },
        },
        data: {
          status: "EXPIRED_DIED",
          resolvedAtEpoch: args.currentEpoch,
        },
      });

      if (update.count === 0) {
        return { expired: false, dogDied: false };
      }

      const dogDied = await markEmergencyDogDeceased({
        tx,
        dog: event.dog,
        currentEpoch: args.currentEpoch,
      });

      return { expired: true, dogDied };
    });

    if (result.expired) {
      expiredCount += 1;
    }

    if (result.dogDied) {
      deceasedDogIds.push(event.dogId);
    }
  }

  return {
    processedCount: expiredEvents.length,
    expiredCount,
    deceasedDogIds,
  };
}
