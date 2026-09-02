import { db } from "@/lib/db";
import {
  DogNamingError,
  updateDogNaming,
} from "@/server/services/dogNaming.service";

export type LitterBulkNamingUpdate = {
  dogId: string;
  callName?: string | null;
  registeredName?: string;
};

type LitterBulkNamingSkip = { dogId: string; reason: string };

export type LitterBulkNamingResult = {
  updatedCount: number;
  skipped: LitterBulkNamingSkip[];
};

export class LitterBulkNamingError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
  }
}

const unavailableForLitterManagement =
  "This puppy is no longer available for litter management.";

export async function updateLitterPuppyNames(args: {
  kennelId: string;
  litterId: string;
  updates: LitterBulkNamingUpdate[];
}): Promise<LitterBulkNamingResult> {
  return db.$transaction(async (tx) => {
    const litter = await tx.litter.findUnique({
      where: { id: args.litterId },
      select: { id: true, bredByKennelId: true },
    });
    if (!litter || litter.bredByKennelId !== args.kennelId) {
      throw new LitterBulkNamingError("Litter not found.", 404);
    }

    const dogs = await tx.dog.findMany({
      where: { id: { in: args.updates.map((update) => update.dogId) } },
      select: {
        id: true,
        litterId: true,
        ownerKennelId: true,
        lifecycleState: true,
        visibilityState: true,
      },
    });
    const dogsById = new Map(dogs.map((dog) => [dog.id, dog]));
    const eligibleUpdates: LitterBulkNamingUpdate[] = [];
    const skipped: LitterBulkNamingSkip[] = [];

    for (const update of args.updates) {
      const dog = dogsById.get(update.dogId);
      if (
        !dog ||
        dog.litterId !== litter.id ||
        dog.ownerKennelId !== args.kennelId ||
        dog.lifecycleState !== "ALIVE" ||
        dog.visibilityState === "HIDDEN_NEONATAL_LOSS"
      ) {
        skipped.push({ dogId: update.dogId, reason: unavailableForLitterManagement });
        continue;
      }
      eligibleUpdates.push(update);
    }

    let updatedCount = 0;
    for (const update of eligibleUpdates) {
      try {
        await updateDogNaming({
          kennelId: args.kennelId,
          dogId: update.dogId,
          ...(update.callName !== undefined ? { callName: update.callName } : {}),
          ...(update.registeredName !== undefined
            ? { registeredName: update.registeredName }
            : {}),
          client: tx,
        });
      } catch (error) {
        if (
          error instanceof DogNamingError &&
          (error.status === 403 || error.status === 404)
        ) {
          skipped.push({ dogId: update.dogId, reason: unavailableForLitterManagement });
          continue;
        }
        throw error;
      }
      updatedCount += 1;
    }

    return { updatedCount, skipped };
  });
}
