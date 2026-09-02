import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import {
  getDogIdsWithPendingVeterinaryCare,
  hasPendingVeterinaryCareForDog,
} from "@/server/services/emergencyVetCare.service";
import { deleteEmptyLitterRuns } from "@/server/services/kennelRun.service";
import {
  getStudContractPuppyProtection,
  getStudContractPuppyProtectionsForDogs,
} from "@/server/services/studContractPuppyProtection.service";
import { extinguishStudContractReturnServicesForDogs } from "@/server/services/studContractReturnService.service";
import {
  PLAYER_SALE_LISTING_TYPE,
  PLAYER_STUD_LISTING_TYPE,
} from "@/server/services/market.service";
import {
  PUPPY_SALE_MIN_AGE_HOURS,
  getPuppyRehomePayout,
} from "@showring/rules";

type RehomeResult = {
  rehomedCount: number;
  creditsAdded: number;
  dogIds: string[];
  cancelledListingCount: number;
};

type RehomeDatabaseClient = Pick<typeof db, "$transaction">;

export type DogRehomeEligibility = {
  eligible: boolean;
  reason: string | null;
};

export class RehomeError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "RehomeError";
    this.status = status;
  }
}

function uniqueDogIds(dogIds: string[]): string[] {
  return [...new Set(dogIds.map((dogId) => dogId.trim()).filter(Boolean))];
}

function evaluateDogRehomeEligibility(args: {
  dog: {
    id: string;
    ownerKennelId: string | null;
    isPlayerVisible: boolean;
    birthEpoch: number;
    lifecycleState: string;
  } | null;
  kennelId: string;
  currentEpoch: number;
  hasPendingVeterinaryCare: boolean;
  studContractProtection: {
    protected: boolean;
    reasonCode: "ACTIVE_SELECTION" | "SELECTED_CLAIM" | null;
  };
  hasActiveDamBreeding: boolean;
}): DogRehomeEligibility {
  const { dog } = args;
  if (!dog || dog.ownerKennelId !== args.kennelId || !dog.isPlayerVisible) {
    return { eligible: false, reason: "This dog is no longer owned by your kennel." };
  }
  if (dog.lifecycleState !== "ALIVE" || args.currentEpoch - dog.birthEpoch < PUPPY_SALE_MIN_AGE_HOURS) {
    return { eligible: false, reason: "Only dogs at least 8 weeks old that are active and owned by your kennel can be re-homed." };
  }
  if (args.hasPendingVeterinaryCare) {
    return { eligible: false, reason: "This dog is awaiting emergency veterinary care." };
  }
  if (args.studContractProtection.protected) {
    return {
      eligible: false,
      reason: args.studContractProtection.reasonCode === "SELECTED_CLAIM"
        ? "This puppy has been selected under an active Stud Contract and cannot be rehomed yet."
        : "This puppy is part of an active Stud Contract selection and cannot be rehomed yet.",
    };
  }
  if (args.hasActiveDamBreeding) {
    return { eligible: false, reason: "Pregnant bitches and bitches awaiting pregnancy checks cannot be re-homed yet." };
  }
  return { eligible: true, reason: null };
}

export async function getDogRehomeEligibility(args: {
  dogId: string;
  kennelId: string;
  currentEpoch: number;
  client?: typeof db | Prisma.TransactionClient;
}): Promise<DogRehomeEligibility> {
  const client = args.client ?? db;
  const dog = await client.dog.findUnique({
    where: { id: args.dogId },
    select: { id: true, ownerKennelId: true, isPlayerVisible: true, birthEpoch: true, lifecycleState: true },
  });
  if (!dog || dog.ownerKennelId !== args.kennelId || !dog.isPlayerVisible) {
    return evaluateDogRehomeEligibility({
      dog,
      kennelId: args.kennelId,
      currentEpoch: args.currentEpoch,
      hasPendingVeterinaryCare: false,
      studContractProtection: { protected: false, reasonCode: null },
      hasActiveDamBreeding: false,
    });
  }
  if (dog.lifecycleState !== "ALIVE" || args.currentEpoch - dog.birthEpoch < PUPPY_SALE_MIN_AGE_HOURS) {
    return evaluateDogRehomeEligibility({
      dog,
      kennelId: args.kennelId,
      currentEpoch: args.currentEpoch,
      hasPendingVeterinaryCare: false,
      studContractProtection: { protected: false, reasonCode: null },
      hasActiveDamBreeding: false,
    });
  }
  const hasPendingVeterinaryCare = await hasPendingVeterinaryCareForDog(dog.id, client);
  if (hasPendingVeterinaryCare) {
    return evaluateDogRehomeEligibility({
      dog,
      kennelId: args.kennelId,
      currentEpoch: args.currentEpoch,
      hasPendingVeterinaryCare,
      studContractProtection: { protected: false, reasonCode: null },
      hasActiveDamBreeding: false,
    });
  }
  const protection = await getStudContractPuppyProtection({ dogId: dog.id, client });
  if (protection.protected) {
    return evaluateDogRehomeEligibility({
      dog,
      kennelId: args.kennelId,
      currentEpoch: args.currentEpoch,
      hasPendingVeterinaryCare,
      studContractProtection: protection,
      hasActiveDamBreeding: false,
    });
  }
  const activeDamBreeding = await client.breedingAttempt.findFirst({
    where: { damId: dog.id, status: { in: ["INITIATED", "PREGNANT", "REPRODUCTIVE_EMERGENCY"] } },
    select: { id: true },
  });
  return evaluateDogRehomeEligibility({
    dog,
    kennelId: args.kennelId,
    currentEpoch: args.currentEpoch,
    hasPendingVeterinaryCare,
    studContractProtection: protection,
    hasActiveDamBreeding: Boolean(activeDamBreeding),
  });
}

export async function rehomeOwnedDogs(args: {
  kennelId: string;
  dogIds: string[];
  currentEpoch: number;
}): Promise<RehomeResult> {
  return rehomeOwnedDogsWithClient(args, db);
}

export async function rehomeOwnedDogsWithClient(
  args: {
    kennelId: string;
    dogIds: string[];
    currentEpoch: number;
  },
  client: RehomeDatabaseClient = db
): Promise<RehomeResult> {
  const dogIds = uniqueDogIds(args.dogIds);

  if (dogIds.length === 0) {
    throw new RehomeError("Select at least one dog to re-home.");
  }

  return client.$transaction(async (tx) => {
    const dogs = await tx.dog.findMany({
      where: {
        id: { in: dogIds },
        ownerKennelId: args.kennelId,
        isPlayerVisible: true,
      },
      select: {
        id: true,
        ownerKennelId: true,
        isPlayerVisible: true,
        birthEpoch: true,
        lifecycleState: true,
        kennelRunId: true,
        litterId: true,
        sex: true,
      },
    });

    if (dogs.length !== dogIds.length) {
      throw new RehomeError(
        "One or more selected dogs could not be found in your kennel.",
        403
      );
    }

    const [dogsWithPendingVeterinaryCare, studContractProtections, activeDamBreedings] = await Promise.all([
      getDogIdsWithPendingVeterinaryCare(dogIds, tx),
      getStudContractPuppyProtectionsForDogs({ dogs, client: tx }),
      tx.breedingAttempt.findMany({
        where: {
          damId: { in: dogIds },
          status: { in: ["INITIATED", "PREGNANT", "REPRODUCTIVE_EMERGENCY"] },
        },
        select: { damId: true },
      }),
    ]);
    const activeDamBreedingDogIds = new Set(
      activeDamBreedings.map((breeding) => breeding.damId)
    );
    const dogsById = new Map(dogs.map((dog) => [dog.id, dog]));

    for (const dogId of dogIds) {
      const eligibility = evaluateDogRehomeEligibility({
        dog: dogsById.get(dogId) ?? null,
        kennelId: args.kennelId,
        currentEpoch: args.currentEpoch,
        hasPendingVeterinaryCare: dogsWithPendingVeterinaryCare.has(dogId),
        studContractProtection: studContractProtections.get(dogId) ?? {
          protected: false,
          reasonCode: null,
        },
        hasActiveDamBreeding: activeDamBreedingDogIds.has(dogId),
      });
      if (!eligibility.eligible) throw new RehomeError(eligibility.reason ?? "This dog cannot be re-homed yet.");
    }

    const payoutDogs = dogIds
      .map((dogId) => dogsById.get(dogId)!)
      .map((dog) => ({
        ...dog,
        payout: getPuppyRehomePayout(args.currentEpoch, dog.birthEpoch),
      }))
      .filter((dog) => dog.payout > 0);
    const creditsAdded = payoutDogs.reduce(
      (total, dog) => total + dog.payout,
      0
    );

    const cancelledListings = await tx.dogListing.updateMany({
      where: {
        dogId: { in: dogIds },
        sellerKennelId: args.kennelId,
        sellerType: "PLAYER",
        listingType: {
          in: [PLAYER_SALE_LISTING_TYPE, PLAYER_STUD_LISTING_TYPE],
        },
        status: "ACTIVE",
      },
      data: {
        status: "CANCELLED",
      },
    });

    const transfer = await tx.dog.updateMany({
      where: {
        id: { in: dogIds },
        ownerKennelId: args.kennelId,
        lifecycleState: "ALIVE",
      },
      data: {
        ownerKennelId: null,
        kennelRunId: null,
        marketState: "NOT_FOR_SALE",
        lifecycleState: "TRANSFERRED",
      },
    });

    if (transfer.count !== dogIds.length) {
      throw new Error("One or more dogs are no longer available to re-home.");
    }
    await extinguishStudContractReturnServicesForDogs({
      client: tx,
      dogIds,
      extinguishedAt: new Date(),
      sireReason: "SIRE_OWNERSHIP_CHANGED",
      damReason: "DAM_OWNERSHIP_CHANGED",
    });

    await deleteEmptyLitterRuns({
      priorRunIds: dogs.map((dog) => dog.kennelRunId),
      client: tx,
    });

    if (creditsAdded > 0) {
      const updatedKennel = await tx.kennel.update({
        where: { id: args.kennelId },
        data: { balance: { increment: creditsAdded } },
        select: { balance: true },
      });
      let runningBalance = updatedKennel.balance - creditsAdded;

      await tx.ledgerTransaction.createMany({
        data: payoutDogs.map((dog) => {
          runningBalance += dog.payout;

          return {
            kennelId: args.kennelId,
            transactionType: "PUPPY_REHOME",
            amount: dog.payout,
            balanceAfter: runningBalance,
            occurredAtEpoch: args.currentEpoch,
            dogId: dog.id,
            memo: "Baseline puppy re-home placement",
          };
        }),
      });
    }

    return {
      rehomedCount: dogIds.length,
      creditsAdded,
      dogIds,
      cancelledListingCount: cancelledListings.count,
    };
  });
}
