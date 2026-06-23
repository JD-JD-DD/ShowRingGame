import { db } from "@/lib/db";
import {
  type DogEmergencyCareEvent,
  type DogEmergencyCareStatus,
  type DogEmergencyCareType,
  type DogEmergencyTreatmentOutcome,
  type Prisma,
} from "@prisma/client";

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

function rollToBasisPoints(random01: number): number {
  if (!Number.isFinite(random01)) {
    throw new Error("Emergency vet-care roll must be a finite number.");
  }

  return Math.max(
    0,
    Math.min(BASIS_POINTS - 1, Math.floor(random01 * BASIS_POINTS))
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
