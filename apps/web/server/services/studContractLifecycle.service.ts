import { db } from "@/lib/db";
import { createKennelNotice } from "@/server/services/kennelNotice.service";

const DEFAULT_BATCH_LIMIT = 50;

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
