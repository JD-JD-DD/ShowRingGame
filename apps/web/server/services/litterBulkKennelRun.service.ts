import { db } from "@/lib/db";
import {
  KennelRunServiceError,
  moveDogsToKennelRun,
} from "@/server/services/kennelRunManagement.service";

export type LitterBulkKennelRunResult = {
  movedCount: number;
  targetRunId: string;
  skipped: { dogId: string; reason: string }[];
};

export class LitterBulkKennelRunError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
  }
}

const unavailableForLitterManagement =
  "This puppy is no longer available for litter management.";

export async function moveLitterPuppiesToKennelRun(args: {
  kennelId: string;
  litterId: string;
  dogIds: string[];
  targetRunId: string;
}): Promise<LitterBulkKennelRunResult> {
  return db.$transaction(async (tx) => {
    const litter = await tx.litter.findUnique({
      where: { id: args.litterId },
      select: { id: true, bredByKennelId: true },
    });
    if (!litter || litter.bredByKennelId !== args.kennelId) {
      throw new LitterBulkKennelRunError("Litter not found.", 404);
    }

    const targetRun = await tx.kennelRun.findUnique({
      where: { id: args.targetRunId },
      select: { id: true, kennelId: true },
    });
    if (!targetRun || targetRun.kennelId !== args.kennelId) {
      throw new KennelRunServiceError("Target Kennel Run not found.", 404);
    }

    const dogs = await tx.dog.findMany({
      where: { id: { in: args.dogIds } },
      select: {
        id: true,
        litterId: true,
        ownerKennelId: true,
        lifecycleState: true,
        visibilityState: true,
        kennelRunId: true,
      },
    });
    const dogsById = new Map(dogs.map((dog) => [dog.id, dog]));
    const affectedDogIds: string[] = [];
    const skipped: LitterBulkKennelRunResult["skipped"] = [];

    for (const dogId of args.dogIds) {
      const dog = dogsById.get(dogId);
      if (
        !dog ||
        dog.litterId !== litter.id ||
        dog.ownerKennelId !== args.kennelId ||
        dog.lifecycleState !== "ALIVE" ||
        dog.visibilityState === "HIDDEN_NEONATAL_LOSS"
      ) {
        skipped.push({ dogId, reason: unavailableForLitterManagement });
      } else if (dog.kennelRunId === targetRun.id) {
        skipped.push({ dogId, reason: "Already in this kennel run." });
      } else {
        affectedDogIds.push(dogId);
      }
    }

    if (affectedDogIds.length === 0) {
      return { movedCount: 0, targetRunId: targetRun.id, skipped };
    }

    const result = await moveDogsToKennelRun({
      kennelId: args.kennelId,
      dogIds: affectedDogIds,
      targetRunId: targetRun.id,
      client: tx,
    });
    return { ...result, skipped };
  });
}
