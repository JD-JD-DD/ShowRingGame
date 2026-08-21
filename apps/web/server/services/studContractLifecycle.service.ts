import { db } from "@/lib/db";
import { epochToDate } from "@/lib/gameClock";
import { createKennelNotice } from "@/server/services/kennelNotice.service";
import { getProjectedDogDeath } from "@/server/services/lifecycle.service";
import { NEONATAL_PUPPY_DEATH_WINDOW_HOURS } from "@showring/rules";

const DEFAULT_BATCH_LIMIT = 50;

export function evaluateStudContractLitterQualification(args: {
  compensationType: "CASH" | "PUPPY_BACK" | "CASH_AND_PUPPY_BACK";
  minimumLitterSize: number | null;
  smallLitterReturnThreshold: number | null;
  survivingPuppyCount: number;
}) {
  let puppyBackMinimumMet: boolean | null = null;
  if (args.compensationType !== "CASH") {
    if (args.minimumLitterSize === null) {
      throw new Error("Accepted Puppy Back StudContract is missing its minimum litter size.");
    }
    puppyBackMinimumMet = args.survivingPuppyCount >= args.minimumLitterSize;
  }
  return {
    puppyBackMinimumMet,
    smallLitterReturnServiceMet: args.smallLitterReturnThreshold === null
      ? null
      : args.survivingPuppyCount <= args.smallLitterReturnThreshold,
  };
}

export async function processStudContractLitterQualifications(args: {
  currentEpoch: number;
  limit?: number;
}) {
  const limit = Math.max(1, Math.min(args.limit ?? DEFAULT_BATCH_LIMIT, 100));
  const candidates = await db.studContract.findMany({
    where: { status: "ACCEPTED", litterId: { not: null }, qualificationCheckpointAt: null, litter: { bornEpoch: { lte: args.currentEpoch - NEONATAL_PUPPY_DEATH_WINDOW_HOURS } } },
    take: limit,
    orderBy: [{ litter: { bornEpoch: "asc" } }, { id: "asc" }],
    include: { litter: { select: { id: true, bornEpoch: true } } },
  });
  const puppies = await db.dog.findMany({
    where: { litterId: { in: candidates.flatMap((contract) => contract.litter?.id ?? []) } },
    select: { id: true, birthEpoch: true, deathEpoch: true, originType: true, litterId: true },
  });
  const checkpointEpochByLitterId = new Map<string, number>();
  for (const contract of candidates) {
    if (!contract.litter) continue;
    checkpointEpochByLitterId.set(
      contract.litter.id,
      contract.litter.bornEpoch + NEONATAL_PUPPY_DEATH_WINDOW_HOURS
    );
  }
  const survivorsByLitterId = new Map<string, number>();
  for (const puppy of puppies) {
    if (!puppy.litterId) continue;
    const checkpointEpoch = checkpointEpochByLitterId.get(puppy.litterId);
    if (checkpointEpoch === undefined) continue;
    if (getProjectedDogDeath(puppy).deathEpoch > checkpointEpoch) {
      survivorsByLitterId.set(puppy.litterId, (survivorsByLitterId.get(puppy.litterId) ?? 0) + 1);
    }
  }
  let qualifiedCount = 0;
  let failedCount = 0;
  for (const contract of candidates) {
    try {
      if (!contract.litter) continue;
      const survivors = survivorsByLitterId.get(contract.litter.id) ?? 0;
      const facts = evaluateStudContractLitterQualification({
        compensationType: contract.compensationType,
        minimumLitterSize: contract.minimumLitterSize,
        smallLitterReturnThreshold: contract.smallLitterReturnThreshold,
        survivingPuppyCount: survivors,
      });
      const update = await db.studContract.updateMany({
        where: { id: contract.id, status: "ACCEPTED", litterId: contract.litter.id, qualificationCheckpointAt: null },
        data: {
          qualificationCheckpointAt: epochToDate(contract.litter.bornEpoch + NEONATAL_PUPPY_DEATH_WINDOW_HOURS),
          qualifyingSurvivingPuppyCount: survivors,
          ...facts,
        },
      });
      qualifiedCount += update.count;
    } catch (error) {
      failedCount += 1;
      console.error("Stud Contract litter qualification failed", { contractId: contract.id, error });
    }
  }
  return { checkedCount: candidates.length, qualifiedCount, failedCount };
}

export async function processExpiredStudContractRequests(args?: {
  now?: Date;
  currentEpoch?: number;
  limit?: number;
}) {
  const now = args?.now ?? new Date();
  const currentEpoch = args?.currentEpoch ?? Math.floor(Date.now() / 1000);
  const limit = Math.max(1, Math.min(args?.limit ?? DEFAULT_BATCH_LIMIT, 100));
  const candidates = await db.studContract.findMany({
    where: { status: "PENDING", approvalDeadlineAt: { lte: now } },
    orderBy: [{ approvalDeadlineAt: "asc" }, { id: "asc" }],
    take: limit,
    select: { id: true, damKennelId: true, damDogId: true, sireDogId: true },
  });
  let expiredCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  for (const candidate of candidates) {
    try {
      const transitioned = await db.$transaction(async (tx) => {
        const update = await tx.studContract.updateMany({
          where: {
            id: candidate.id,
            status: "PENDING",
            approvalDeadlineAt: { lte: now },
          },
          data: { status: "EXPIRED", expiredAt: now },
        });
        if (update.count !== 1) return false;
        await createKennelNotice({
          client: tx,
          kennelId: candidate.damKennelId,
          sourceKey: `STUD_MANUAL_EXPIRED:${candidate.id}`,
          type: "KENNEL_SERVICE",
          title: "Stud approval request expired",
          body: "The stud approval request expired before it was approved.",
          currentEpoch,
          linkedDogId: candidate.damDogId,
          metadataJson: { studContractId: candidate.id, sireDogId: candidate.sireDogId },
        });
        return true;
      });
      if (transitioned) expiredCount += 1;
      else skippedCount += 1;
    } catch (error) {
      failedCount += 1;
      console.error("Stud Contract expiry failed", { contractId: candidate.id, error });
    }
  }
  return { checkedCount: candidates.length, expiredCount, skippedCount, failedCount };
}
