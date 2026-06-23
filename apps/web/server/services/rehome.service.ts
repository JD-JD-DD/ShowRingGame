import { db } from "@/lib/db";
import { assertDogHasNoPendingEmergencyCare } from "@/server/services/emergencyVetCare.service";
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

export async function rehomeOwnedDogs(args: {
  kennelId: string;
  dogIds: string[];
  currentEpoch: number;
}): Promise<RehomeResult> {
  const dogIds = uniqueDogIds(args.dogIds);

  if (dogIds.length === 0) {
    throw new RehomeError("Select at least one dog to re-home.");
  }

  const dogs = await db.dog.findMany({
    where: {
      id: { in: dogIds },
      ownerKennelId: args.kennelId,
      isPlayerVisible: true,
    },
    select: {
      id: true,
      birthEpoch: true,
      lifecycleState: true,
    },
  });

  if (dogs.length !== dogIds.length) {
    throw new RehomeError(
      "One or more selected dogs could not be found in your kennel.",
      403
    );
  }

  const blockedDog = dogs.find((dog) => {
    const ageHours = args.currentEpoch - dog.birthEpoch;

    return ageHours < PUPPY_SALE_MIN_AGE_HOURS || dog.lifecycleState !== "ALIVE";
  });

  if (blockedDog) {
    throw new RehomeError(
      "Only dogs at least 8 weeks old that are active and owned by your kennel can be re-homed."
    );
  }

  const dogsById = new Map(dogs.map((dog) => [dog.id, dog]));
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

  return db.$transaction(async (tx) => {
    for (const dogId of dogIds) {
      await assertDogHasNoPendingEmergencyCare(dogId, tx);
    }

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
        marketState: "NOT_FOR_SALE",
        lifecycleState: "TRANSFERRED",
      },
    });

    if (transfer.count !== dogIds.length) {
      throw new Error("One or more dogs are no longer available to re-home.");
    }

    await tx.kennelAreaDog.deleteMany({
      where: {
        dogId: { in: dogIds },
        area: {
          kennelId: args.kennelId,
        },
      },
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
