import { fail, ok } from "@/lib/http";
import { getCurrentEpoch } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";
import { db } from "@/lib/db";
import { getKennelForUser } from "@/server/services/kennel.service";
import { createKennelNotice } from "@/server/services/kennelNotice.service";

export async function POST(_: Request, { params }: { params: Promise<{ contractId: string }> }) {
  try {
    const userId = await getSessionUserId(); if (!userId) return fail("Unauthorized.", 401);
    const kennel = await getKennelForUser(userId); if (!kennel) return fail("Kennel not found.", 404);
    const { contractId } = await params;
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "StudContract" WHERE "id" = ${contractId} FOR UPDATE`;
      const contract = await tx.studContract.findFirst({ where: { id: contractId, status: "PENDING", sireKennelId: kennel.id }, select: { id: true, damKennelId: true, damDogId: true, sireDogId: true } });
      if (!contract) throw new Error("This Stud approval request is no longer pending.");
      await tx.studContract.update({ where: { id: contract.id }, data: { status: "DECLINED", declinedAt: new Date() } });
      await createKennelNotice({ client: tx, kennelId: contract.damKennelId, sourceKey: `STUD_MANUAL_DECLINED:${contract.id}`, type: "KENNEL_SERVICE", title: "Stud approval declined", body: "The requested stud approval was declined. No breeding or payment occurred.", currentEpoch: getCurrentEpoch(), linkedDogId: contract.damDogId, metadataJson: { studContractId: contract.id, sireDogId: contract.sireDogId } });
    });
    return ok({ message: "Stud approval request declined." });
  } catch (error) { return fail(error instanceof Error ? error.message : "Unable to decline Stud approval.", 400); }
}
