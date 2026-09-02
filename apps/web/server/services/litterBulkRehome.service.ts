import { getCurrentEpoch } from "@/lib/gameClock";
import { db } from "@/lib/db";
import {
  getDogRehomeEligibility,
  rehomeOwnedDogs,
} from "@/server/services/rehome.service";

export type LitterBulkRehomeResult = {
  rehomedCount: number;
  skipped: { dogId: string; reason: string }[];
};

export class LitterBulkRehomeError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
  }
}

const unavailableForLitterRehome =
  "This puppy is no longer available for re-home from this litter.";

export async function rehomeLitterPuppies(args: {
  kennelId: string;
  litterId: string;
  dogIds: string[];
}): Promise<LitterBulkRehomeResult> {
  const litter = await db.litter.findUnique({
    where: { id: args.litterId },
    select: { id: true, bredByKennelId: true },
  });
  if (!litter || litter.bredByKennelId !== args.kennelId) {
    throw new LitterBulkRehomeError("Litter not found.", 404);
  }

  const dogs = await db.dog.findMany({
    where: { id: { in: args.dogIds } },
    select: {
      id: true,
      litterId: true,
      ownerKennelId: true,
      lifecycleState: true,
      visibilityState: true,
      isPlayerVisible: true,
    },
  });
  const dogsById = new Map(dogs.map((dog) => [dog.id, dog]));
  const currentEpoch = getCurrentEpoch();
  const affectedDogIds: string[] = [];
  const skipped: LitterBulkRehomeResult["skipped"] = [];

  for (const dogId of args.dogIds) {
    const dog = dogsById.get(dogId);
    if (
      !dog ||
      dog.litterId !== litter.id ||
      dog.ownerKennelId !== args.kennelId ||
      dog.lifecycleState !== "ALIVE" ||
      dog.visibilityState === "HIDDEN_NEONATAL_LOSS" ||
      !dog.isPlayerVisible
    ) {
      skipped.push({ dogId, reason: unavailableForLitterRehome });
      continue;
    }

    const eligibility = await getDogRehomeEligibility({
      dogId,
      kennelId: args.kennelId,
      currentEpoch,
    });
    if (!eligibility.eligible) {
      skipped.push({ dogId, reason: eligibility.reason ?? unavailableForLitterRehome });
      continue;
    }
    affectedDogIds.push(dogId);
  }

  if (affectedDogIds.length === 0) return { rehomedCount: 0, skipped };

  const result = await rehomeOwnedDogs({
    kennelId: args.kennelId,
    dogIds: affectedDogIds,
    currentEpoch,
  });
  return { rehomedCount: result.rehomedCount, skipped };
}
